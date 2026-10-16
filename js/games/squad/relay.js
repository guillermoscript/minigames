'use strict';
/* ═════════ SQUAD · RELAY RACE (sq_relay), 3-4 players, one role each ═════════
   School sports day. A relay race with ONE baton and a goat that wants it. Every player owns ONE leg of the track (role r = leg r),
   each with its own obstacle: HURDLES (0, the JUDGE: tap = jump), MUD (1: mash), WIND (2: hold), PUDDLES (3: move to the dry lane).
   n = 3 has no PUDDLES leg. The baton goes 0 -> 1 -> 2 (-> 3). Runner k hands it over by pressing PASS inside the green zone at the end of its leg
   (a clean pass gives the next runner a speed boost, a missed one is a FUMBLE: the runner stands there picking it up). The zone shrinks
   leg after leg. Obstacles of a leg are only visible a little ahead of the runner (dust), except for the COACH: while you wait for the
   baton you coach the runner in front (role k coaches k-1, role 0 coaches the last leg once it has passed): FLASH makes the next obstacle
   of that leg pop out of the dust on the runner's screen. Win = the baton crosses the finish before the clock. No role can win alone.
   All the sim runs in "tau" seconds (real seconds * sqrt(sp)), so distances never depend on the speed. Level = seeded (mkR, 12 draws/leg).
   Netcode: every role owns its variables, the others render them:
     RUNNER r  'run' [x, flags] (coalesced ≤10/s: x along my leg; flags = air | stalled<<1 | busy<<2 | lane<<3 | state<<4, state 0 wait / 1 run / 2 done)
               'baton' {q}   (I handed the baton over: q 0 fumble, 1 clean, 2 perfect; the next runner starts running when it arrives)
               'fin'         (the last runner crossed the finish: the judge turns it into the verdict)
     COACH     'cue' i        (flash obstacle i of the leg of the runner I coach)
   The judge (role 0) sends the verdict ('end', via wire). ═════════ */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic randomness: never the level's R

/* ───────────── geometry (800×600; HUD keeps y<58, the top-left box, the top-right corner and y>552) ───────────── */
const L = 1200, STALL = 1.4, AIR = .42, START = .9, SIGHTT = .34;
const KIND = ['hurdle', 'mud', 'wind', 'puddle'];
const LANEY = [372, 438], TR0 = 330, TR1 = 480, CAMX = 230;
const DEF = ['#FFE14D', '#6EA8FE', '#5CFF7A', '#FF4D9E'];
const GOAT = '#f1ecdf', GOAT2 = '#cfc7b4';

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function poly(pts) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.closePath(); }
function glint(x, y, rx, ry, rot = -.4, a = .5) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
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
function keyCap(x, y, label) {
  X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.max(26, X.measureText(label).width + 16);
  rr(x - w / 2, y - 11, w, 22, 6); ink('#fff', 2.5); txt(label, x, y + 1, 15, INK, 'center', w - 6);
}
function plate(cx, y, w, h, face, base, label, key, down, grey, icon) {
  const x = cx - w / 2, d = grey || down ? 3 : 9, fy = y + 9 - d;
  rr(x, y + 9, w, h, 20); ink(grey ? '#8f88a6' : base, 4);
  rr(x, fy, w, h, 20); ink(grey ? '#d3cfe0' : face, 4);
  X.fillStyle = 'rgba(255,255,255,.3)'; rr(x + 14, fy + 6, w - 28, h * .16, 6); X.fill();
  if (icon) icon(x + 40, fy + h / 2);
  const lx = icon ? x + w * .6 : cx, hasKey = key && !TOUCH;
  txt(label, lx, fy + h / 2 - (hasKey ? 9 : 0), 25, grey ? '#f6f4fb' : '#fff', 'center', w * (icon ? .5 : .8));
  if (hasKey) keyCap(lx, fy + h - 15, key);
}
function bobPill(x, y, label, col) {                       // a little name tag
  X.font = '700 14px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = t(label), w = Math.min(86, X.measureText(s).width + 16);
  rr(x - w / 2, y - 12, w, 24, 12); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 9, w - 12, 5, 2.5); X.fill();
  txt(label, x, y + 1, 14, INK, 'center', w - 10);
}

/* ───────────── scenery ───────────── */
let TILE = null;
function buildTile() {                                     // the stadium: a 400 px tile that repeats while the camera scrolls
  const cv = document.createElement('canvas'); cv.width = 400; cv.height = H; const old = X; X = cv.getContext('2d');
  let g = X.createLinearGradient(0, 0, 0, 200); g.addColorStop(0, '#79d4ff'); g.addColorStop(1, '#e6f8ff'); X.fillStyle = g; X.fillRect(0, 0, 400, 260);
  X.fillStyle = '#8a74e0'; X.fillRect(0, 110, 400, 142); X.fillStyle = '#6f5ac4'; for (let r = 0; r < 5; r++) X.fillRect(0, 138 + r * 28, 400, 5);   // the stands
  const PAL = ['#ff7aa8', '#ffd23f', '#6EA8FE', '#5CFF7A', '#ff9a4d', '#fff1a8'];
  for (let r = 0; r < 4; r++) for (let i = 0; i < 12; i++) {
    const cx = i * 33.4 + 10 + (r % 2) * 14, cy = 126 + r * 28 + (hash(i * 7 + r) - .5) * 4; X.beginPath(); X.arc(cx, cy, 8, 0, TAU); ink(PAL[(i * 3 + r * 5) % 6], 2.5);
    X.fillStyle = INK; X.fillRect(cx - 3.5, cy - 1, 2, 3); X.fillRect(cx + 1.5, cy - 1, 2, 3);
  }
  X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 88); X.quadraticCurveTo(100, 104, 200, 88); X.quadraticCurveTo(300, 104, 400, 88); X.stroke();   // pennants
  for (let i = 0; i < 8; i++) { const px = 25 + i * 50, py = 94 + Math.sin(i * Math.PI / 2 + 1.5) * 0; poly([[px - 9, py - 4], [px + 9, py - 4], [px, py + 16]]); ink(PAL[i % 6], 2.5); }
  X.fillStyle = '#fff'; X.fillRect(0, 250, 400, 12); X.strokeStyle = INK; X.lineWidth = 3.5; X.beginPath(); X.moveTo(0, 250); X.lineTo(400, 250); X.moveTo(0, 262); X.lineTo(400, 262); X.stroke();   // fence
  X.fillStyle = '#5ccf6a'; X.fillRect(0, 262, 400, TR0 - 262); X.fillStyle = '#4cbf5a'; for (let i = 0; i < 8; i += 2) X.fillRect(i * 50, 262, 50, TR0 - 262);
  g = X.createLinearGradient(0, TR0, 0, TR1); g.addColorStop(0, '#ee8450'); g.addColorStop(1, '#d4653c'); X.fillStyle = g; X.fillRect(0, TR0, 400, TR1 - TR0);
  X.fillStyle = 'rgba(255,255,255,.1)'; for (let i = 0; i < 6; i++) X.fillRect(i * 70 + 10, TR0 + 8, 30, TR1 - TR0 - 16);
  X.fillStyle = '#4cbf5a'; X.fillRect(0, TR1, 400, H - TR1);
  X.strokeStyle = INK; X.lineWidth = 11; for (const y of [TR0, 405, TR1]) { X.beginPath(); X.moveTo(0, y); X.lineTo(400, y); X.stroke(); }
  X.strokeStyle = '#fff'; X.lineWidth = 5; for (const y of [TR0, 405, TR1]) { X.beginPath(); X.moveTo(0, y); X.lineTo(400, y); X.stroke(); }
  for (let i = 0; i < 2; i++) { rr(i * 200 + 24, 500, 150, 34, 8); ink(i ? '#ffd23f' : '#6EA8FE', 3.5); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(i * 200 + 34, 506, 90, 5); }   // sponsor boards
  X = old; return cv;
}
function sky(T, cam) {                                     // a slow cloud or two drifting over the stands
  for (let i = 0; i < 3; i++) { const cx = ((i * 330 + 60 - cam * .12 - T * 6) % 1000 + 1000) % 1000 - 100; X.save(); X.translate(cx, 40 + i * 14);
    X.beginPath(); for (const [a, b, r] of [[-22, 3, 14], [-5, -5, 18], [15, 0, 15], [28, 6, 11]]) { X.moveTo(a + r, b); X.arc(a, b, r, 0, TAU); } ink('#fff', 2.5); X.restore(); }
}

/* ───────────── the characters and props ───────────── */
function baton(x, y, ang, s = 1) {
  X.save(); X.translate(x, y); X.rotate(ang); X.scale(s, s);
  rr(-19, -5, 38, 10, 5); ink('#fff', 3);
  X.save(); rr(-19, -5, 38, 10, 5); X.clip(); X.fillStyle = '#e8434f'; X.fillRect(-12, -6, 7, 12); X.fillRect(2, -6, 7, 12); X.restore();
  X.fillStyle = 'rgba(255,255,255,.7)'; X.fillRect(-15, -3, 10, 2); X.restore();
}
function hurdle(x, fy, hit) {
  if (hit) { X.save(); X.translate(x, fy); X.rotate(.35); rr(-26, -12, 52, 11, 4); ink('#e8434f', 3); rr(-24, -3, 5, 8, 2); ink('#fff', 2); rr(18, -3, 5, 8, 2); ink('#fff', 2); X.restore(); return; }
  rr(x - 22, fy - 46, 7, 46, 2); ink('#fff', 3); rr(x + 15, fy - 46, 7, 46, 2); ink('#fff', 3);
  rr(x - 28, fy - 50, 56, 13, 5); ink('#e8434f', 3.5); X.save(); rr(x - 28, fy - 50, 56, 13, 5); X.clip(); X.fillStyle = '#fff'; for (let i = 0; i < 4; i++) X.fillRect(x - 24 + i * 15, fy - 52, 7, 16); X.restore();
  glint(x - 12, fy - 46, 8, 2, 0, .6);
}
function mudPatch(x0, w, fy, T) {
  const cx = x0 + w / 2; el(cx, fy + 6, w / 2 + 6, 22); ink('#6b3f22', 4); el(cx, fy + 3, w / 2 - 4, 16); X.fillStyle = '#93602f'; X.fill();
  for (let i = 0; i < 5; i++) { const k = (T * .8 + i * .37) % 1, bx = x0 + 18 + hash(i + 3) * (w - 36); X.globalAlpha = 1 - k; X.beginPath(); X.arc(bx, fy + 4 - k * 14, 3 + hash(i) * 3, 0, TAU); ink('#b87b43', 2); X.globalAlpha = 1; }
  glint(cx - w * .2, fy - 2, w * .16, 4, -.1, .35);
}
function windZone(x0, w, T, on) {
  X.fillStyle = on ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.08)'; X.fillRect(x0, TR0 + 4, w, TR1 - TR0 - 8);
  for (let i = 0; i < 7; i++) { const k = (T * (1.1 + i * .06) + i * .31) % 1, y = TR0 + 24 + i * 19, xx = x0 + k * (w + 60) - 30; X.globalAlpha = on ? .95 : .55; line([[xx, y], [xx + 44, y]], 3, '#fff'); line([[xx + 44, y], [xx + 52, y - 4]], 3, '#fff'); X.globalAlpha = 1; }
  X.save(); X.translate(x0 - 18, TR0 - 6);                  // the big fan that blows it
  rr(-5, 0, 10, 60, 3); ink('#9aa6bf', 3); X.beginPath(); X.arc(0, -4, 26, 0, TAU); ink('#cfe3ff', 4);
  for (let i = 0; i < 3; i++) { X.save(); X.translate(0, -4); X.rotate(T * 14 + i * TAU / 3); el(0, -13, 7, 13); ink('#6EA8FE', 2.5); X.restore(); }
  X.beginPath(); X.arc(0, -4, 5, 0, TAU); ink('#ffd23f', 2.5); X.restore();
}
function puddle(x, lane, T) {
  const y = LANEY[lane] + 12; el(x, y, 50, 15); ink('#3aa8ee', 4); el(x, y - 1, 40, 10); X.fillStyle = '#8fdcff'; X.fill();
  glint(x - 14, y - 4, 12, 3, -.1, .7); const k = (T * .9 + x * .01) % 1; X.globalAlpha = 1 - k; el(x + 10, y, 8 + k * 22, 3 + k * 6); X.strokeStyle = '#fff'; X.lineWidth = 2; X.stroke(); X.globalAlpha = 1;
}
function cueMark(x, y, T) {                                // the coach's flash: a gold arrow and a ring on the obstacle
  const b = Math.sin(T * 10) * 3; poly([[x - 12, y - 30 + b], [x + 12, y - 30 + b], [x, y - 10 + b]]); ink('#ffe14d', 3.5);
  X.globalAlpha = .6 + .3 * Math.sin(T * 9); X.beginPath(); X.arc(x, y + 12, 38, 0, TAU); X.lineWidth = 4; X.strokeStyle = '#ffe14d'; X.stroke(); X.globalAlpha = 1;
}
function goat(x, fy, T, mood, chew) {                      // the goat that wants the baton. mood: calm | happy | full
  X.save(); X.translate(x, fy);
  const ch = chew ? Math.sin(T * 18) * 2.5 : 0;
  for (const lx of [-18, -6, 14, 24]) { rr(lx - 3, -22, 7, 24, 2); ink(GOAT2, 3); }
  el(2, -34, 34, 22); ink(GOAT, 4); glint(-10, -44, 14, 4, -.2, .7);
  line([[34, -40], [46, -52]], 5, GOAT2);                  // tail up
  el(-34, -52 + ch * .3, 18, 16); ink(GOAT, 4);            // head
  poly([[-44, -64], [-52, -88], [-34, -66]]); ink('#c9a86a', 3); poly([[-30, -66], [-26, -90], [-20, -62]]); ink('#c9a86a', 3);   // horns
  poly([[-26, -48], [-36, -33 + ch], [-40, -46]]); ink(GOAT2, 2.5);                                                               // beard
  X.beginPath(); X.arc(-40, -55, 4.5, 0, TAU); ink('#fff', 2); X.fillStyle = INK; X.beginPath(); X.arc(-41, -55, mood === 'happy' ? 1.3 : 2.2, 0, TAU); X.fill();
  X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.moveTo(-50, -44 + ch); X.quadraticCurveTo(-42, -40 + ch, -34, -44); X.stroke();
  X.restore();
}
function sweatDrop(x, y, k) { const a = 1 - k; if (a <= 0) return; X.globalAlpha = a; const yy = y + k * 12; X.beginPath(); X.moveTo(x, yy - 4); X.quadraticCurveTo(x + 3.4, yy + 1, x, yy + 4); X.quadraticCurveTo(x - 3.4, yy + 1, x, yy - 4); ink('#9fe3ff', 1.5); X.globalAlpha = 1; }

/* ═════════ the game ═════════ */
function relay(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), TS = Math.sqrt(sp), n = D.roles >= 4 ? 4 : 3, role = D.role, judge = role === 0, last = role === n - 1;
  const kind = KIND[role], V = L / (n === 4 ? 2.7 : 3.3), SIGHT = V * SIGHTT;
  /* the level: 4 legs x 4 obstacles, always 12 draws a leg. Positions in px along the leg. */
  const OB = [];
  for (let j = 0; j < 4; j++) {
    const k = KIND[j], cnt = k === 'mud' || k === 'wind' ? 3 : 4, arr = [];
    for (let i = 0; i < 4; i++) {
      const a = R(), b = R(), c = R(); if (i >= cnt) continue;
      arr.push({ i, k, x: cnt === 4 ? 190 + i * 205 + (a - .5) * 30 : 210 + i * 285 + (a - .5) * 40, w: k === 'mud' ? 150 + b * 30 : k === 'wind' ? 170 + b * 30 : 0, lane: k === 'puddle' && c > .72 ? 1 : 0, cued: false, hit: false });
    }
    if (k === 'puddle') { let z = arr.filter(o => o.lane === 0).length; for (const o of arr) if (z < 3 && o.lane === 1) { o.lane = 0; z++; } }   // an idle runner (lane 0) must get wet
    OB.push(arr);
  }
  const Z0 = Array.from({ length: n }, (_, j) => j === n - 1 ? L : L - V * lerp(.78, .42, n > 2 ? j / (n - 2) : 0));   // where the green zone of leg j starts
  const LEG = OB[role];
  /* state */
  const xT = Array.from({ length: n }, () => track()), fl = Array(n).fill(0), airAt = Array(n).fill(-9), lnV = Array(n).fill(0), laneOf = r => (fl[r] >> 3) & 1;
  let st = 0, x = 0, stall = 0, air = 0, m = 0, held = false, kHold = false, laneV = 0, laneTgt = 0, boost = 0, passed = false, pending = false, oi = 0;
  let lastX = -1, lastFl = -1, runAt = -9, cueAt = -9, tripAt = -9, resAt = -1, camX = null, fin = false, flyAt = -9, flyFrom = 0, flyQ = 0, passAt = -9, busyAt = -9, pressAt = -9;
  const pops = [], bits = [];
  const colOf = r => (D.byRole && D.byRole[r] && D.byRole[r].color) || DEF[r];
  const nameOf = r => r === role ? 'YOU' : ((D.byRole && D.byRole[r] && D.byRole[r].name) || 'P' + (r + 1)).slice(0, 7);
  const S = f => { try { f(); } catch (e) { /* audio */ } };
  const pos = r => r === role ? x : (xT[r].at() === null ? 0 : xT[r].at());
  const stOf = r => r === role ? st : fl[r] >> 4;
  const coachOf = j => (j + 1) % n, coached = (role - 1 + n) % n;
  const coachMode = () => (role > 0 && st === 0) || (role === 0 && st === 2);
  const visible = (j, o) => {                              // can I see obstacle o of leg j on my screen?
    if (o.cued || coachOf(j) === role) return true;
    const dx = o.x + (o.w || 0) - pos(j); return dx < SIGHT && dx > -140 || (o.w && o.x < pos(j) && dx > -40);
  };
  const pop = (s, wx, y, size, bgc, fg) => { pops.length = Math.min(pops.length, 2); pops.push({ s, wx, y, size, bgc, fg, t0: g.c, rot: (hash(g.c * 9) - .5) * .14 }); };
  const bit = (px, py, c) => { for (let i = 0; i < 6; i++) bits.push({ x: px, y: py, vx: (hash(i + g.c) - .5) * 240, vy: -120 - hash(i * 3 + g.c) * 120, t0: g.c, c }); };
  const myFl = () => (air > 0 ? 1 : 0) | (stall > 0 ? 2 : 0) | (g.c - busyAt < .25 ? 4 : 0) | ((Math.round(laneV) ? 1 : 0) << 3) | (st << 4);
  const trip = (o, why) => {
    stall = STALL; tripAt = g.c; o.hit = true; S(() => (why === 'wet' ? sfx.splat : sfx.thud)()); shake(5, .15); bit(L * role + x, LANEY[Math.round(laneV)] - 20, why === 'wet' ? '#8fdcff' : '#fff');
    pop(why === 'wet' ? 'SPLASH!' : 'OOPS!', role * L + x, 250, 24, '#e8434f', '#fff');
  };
  const begin = q => { st = 1; x = 0; boost = q === 2 ? 1.3 : q === 1 ? .6 : 0; };
  const setLane = py => { if (kind === 'puddle') laneTgt = py < 405 ? 0 : 1; };
  function press() {
    if (g.result) return; pressAt = g.c;
    if (st === 1) {
      if (!last && x >= Z0[role] && !passed) {             // PASS inside the green zone
        const u = (x - Z0[role]) / (L - Z0[role]), q = u >= .6 ? 2 : 1;
        passed = true; st = 2; D.send('baton', { q }); onBaton(role, q);
      } else if (kind === 'hurdle' && air <= 0 && stall <= 0) { air = AIR; busyAt = g.c; S(() => sfx.whoosh(true)); }
      else if (kind === 'mud') { m = Math.min(1.25, m + .35); busyAt = g.c; }
    } else if (coachMode() && g.c - cueAt > .22) {
      const o = OB[coached].find(q => !q.cued && q.x + (q.w || 0) > pos(coached) - 10);
      if (o && stOf(coached) === 1) { o.cued = true; cueAt = g.c; D.send('cue', o.i); S(() => sfx.tickHi()); pop('FLASH!', coached * L + pos(coached) + 160, 240, 18, '#c99512', '#fff'); }
    }
  }
  function onBaton(from, q) {
    flyAt = g.c; flyFrom = from; flyQ = q; S(() => (q ? sfx.coin : sfx.miss)());
    pop(q === 2 ? 'PERFECT PASS!' : q === 1 ? 'CLEAN PASS!' : 'FUMBLE!', (from + 1) * L - 150, 250, 26, q ? '#22a447' : '#e8434f', '#fff');
    if (q) bit((from + 1) * L, 380, '#ffe14d');
  }
  const g = {
    c: 0, dur: 17, pts: 0,
    cmd: kind === 'hurdle' ? 'JUMP!' : kind === 'mud' ? 'MASH!' : kind === 'wind' ? 'HOLD!' : 'DODGE!',
    roleLabel: ['HURDLES', 'MUD', 'WIND', 'PUDDLES'][role],
    hint: kind === 'hurdle' ? 'CLICK / SPACE TO JUMP THE HURDLES - PRESS IN THE GREEN ZONE TO PASS THE BATON'
      : kind === 'mud' ? 'MASH CLICK / SPACE TO WADE THROUGH THE MUD - PRESS IN THE GREEN ZONE TO PASS THE BATON'
      : kind === 'wind' ? 'HOLD CLICK / SPACE IN THE GUSTS - PRESS IN THE GREEN ZONE TO PASS THE BATON'
      : 'MOVE THE MOUSE (OR W / S) TO SWITCH LANE AROUND THE PUDDLES - CLICK IN THE GREEN ZONE TO PASS',
    thint: kind === 'hurdle' ? 'TAP TO JUMP THE HURDLES - TAP IN THE GREEN ZONE TO PASS THE BATON'
      : kind === 'mud' ? 'TAP FAST TO WADE THROUGH THE MUD - TAP IN THE GREEN ZONE TO PASS THE BATON'
      : kind === 'wind' ? 'HOLD YOUR FINGER IN THE GUSTS - TAP IN THE GREEN ZONE TO PASS THE BATON'
      : 'TAP ABOVE / BELOW THE LINE TO SWITCH LANE - TAP IN THE GREEN ZONE TO PASS THE BATON',
    update(dt) {
      g.c += dt; const d = dt * TS;
      if (g.result && resAt < 0) resAt = g.c;
      air = Math.max(0, air - d); m = Math.max(0, m - 2 * d);
      laneV += clamp(laneTgt - laneV, -8 * d, 8 * d);
      for (let r = 0; r < n; r++) { const tg = r === role ? laneV : laneOf(r); lnV[r] += (tg - lnV[r]) * Math.min(1, dt * 14); }
      if (!g.result) {
        if (judge && st === 0 && g.c >= START) begin(1);
        if (st === 1) {
          if (stall > 0) { stall -= d; if (stall <= 0) { stall = 0; if (pending) { pending = false; st = 2; D.send('baton', { q: 0 }); onBaton(role, 0); } } }
          else {
            let f = 1; const o = LEG.find(q => (q.k === 'mud' || q.k === 'wind') && x >= q.x && x <= q.x + q.w);
            if (o && o.k === 'mud') f = .12 + .88 * clamp(m, 0, 1); else if (o && o.k === 'wind') f = held || kHold ? .85 : .1;
            if (boost > 0) { f *= 1.35; boost -= d; }
            x += V * f * d;
            while (oi < LEG.length && x >= LEG[oi].x) {
              const q = LEG[oi++];
              if (q.k === 'hurdle' && air <= 0) trip(q, 'hit'); else if (q.k === 'puddle' && Math.round(laneV) === q.lane) trip(q, 'wet');
              else if (q.k === 'hurdle' || q.k === 'puddle') bit(role * L + q.x, LANEY[0], '#fff');
            }
            if (x >= L) {
              x = L;
              if (last) { st = 2; fin = true; D.send('fin', 1); }
              else if (!passed) { passed = true; pending = true; stall = STALL; pop('FUMBLE!', role * L + L - 100, 250, 26, '#e8434f', '#fff'); }
            }
          }
        } else if (st === 2 && x < L + 36 && !last) x += V * .5 * d;
        const rx = Math.round(x), f2 = myFl();
        if ((rx !== lastX || f2 !== lastFl) && g.c - runAt >= .09) { lastX = rx; lastFl = f2; runAt = g.c; D.send('run', [rx, f2], true); }
        if (judge && !g.result && g.c >= g.limit) g.finish('lose');
      }
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += 700 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (g.c - b.t0 > .6) bits.splice(i, 1); }
      for (let i = pops.length - 1; i >= 0; i--) if (g.c - pops[i].t0 > 1.1) pops.splice(i, 1);
      const car = carrier(), tx = clamp(car * L + pos(car) - CAMX, -40, n * L + 200 - W);
      camX = camX === null ? tx : camX + (tx - camX) * Math.min(1, dt * 5);
    },
    msg(type, d, from) {
      if (type === 'run' && Array.isArray(d) && from >= 0 && from < n && from !== role) { xT[from].push(d[0]); if (!(fl[from] & 1) && (d[1] & 1)) airAt[from] = g.c; fl[from] = d[1] | 0; }
      else if (type === 'baton' && d && from < n - 1 && from !== role) {
        onBaton(from, d.q | 0);
        if (from === role - 1 && st === 0) begin(d.q | 0);
      } else if (type === 'cue' && typeof d === 'number') { const j = (from - 1 + n) % n, o = OB[j] && OB[j][d]; if (o) { o.cued = true; if (from !== role) S(() => sfx.tickHi()); } }
      else if (type === 'fin' && judge && from === n - 1 && !g.result) g.finish('win');
    },
    down(pt) { held = true; if (pt) setLane(pt.y); press(); },
    up() { held = false; },
    move(pt) { if (pt) setLane(pt.y); },
    key(e) {
      const c = e.code; if (c === 'KeyP' || c === 'KeyM' || c === 'Escape') return;
      if (kind === 'puddle' && (c === 'ArrowUp' || c === 'KeyW')) { laneTgt = 0; return; }
      if (kind === 'puddle' && (c === 'ArrowDown' || c === 'KeyS')) { laneTgt = 1; return; }
      if ((c === 'Space' || c === 'Enter' || c === 'ArrowRight' || c === 'KeyD' || c === 'ArrowUp' || c === 'KeyW') && !e.repeat) { kHold = true; press(); }
    },
    keyup(e) { const c = e.code; if (c === 'Space' || c === 'Enter' || c === 'ArrowRight' || c === 'KeyD' || c === 'ArrowUp' || c === 'KeyW') kHold = false; },
  };
  function carrier() { for (let r = 0; r < n; r++) if (stOf(r) !== 2) return r; return n - 1; }

  /* ───────── drawing ───────── */
  function drawRunner(r, T, won, lost, rk) {
    const wx = r * L + pos(r), sxp = wx - camX, s = stOf(r), f = r === role ? myFl() : fl[r];
    if (sxp < -70 || sxp > W + OX + 70) return;
    const fy = LANEY[0] + (LANEY[1] - LANEY[0]) * lnV[r], col = colOf(r);
    let hop = 0; const isAir = r === role ? air > 0 : (f & 1) && g.c - airAt[r] < AIR / TS + .1;
    if (isAir) { const k = r === role ? 1 - air / AIR : clamp((g.c - airAt[r]) / (AIR / TS), 0, 1); hop = Math.sin(k * Math.PI) * 52; }
    const stalled = r === role ? stall > 0 : !!(f & 2), moving = s === 1 && !stalled;
    shadow(sxp, fy + 3, 22 - hop * .15, 6, .25);
    X.save(); X.translate(sxp, fy - hop);
    if (stalled && !won && !lost) { X.rotate(-1.35); X.translate(18, 0); }
    else if (won) X.translate(0, -Math.abs(Math.sin(T * 9 + r)) * 14);
    else if (r === 2 && s === 1 && KIND[r] === 'wind') X.rotate(.14);
    X.translate(-sxp, -fy);
    // the arm that holds the baton (a block like caos' stubs)
    caos(sxp, fy, 3.2, { col, mood: won ? 'happy' : lost ? 'sad' : stalled ? 'sad' : null, run: moving ? wx * .0035 : null });
    X.beginPath(); X.arc(sxp, fy - 22, 8.5, 0, TAU); ink('#fff', 2.5); txt(String(r + 1), sxp, fy - 21, 13, INK);
    X.restore();
    if (stalled && !won && !lost) for (let i = 0; i < 3; i++) { const a = T * 7 + i * TAU / 3; star(sxp + 10 + Math.cos(a) * 20, fy - 40 + Math.sin(a) * 6, 7, 3, 5, a, '#FFE14D', 2.5); }
    else if (s === 1 && (f & 4) && !stalled) sweatDrop(sxp + 16, fy - 52 - hop, (T * 3 + r) % 1);
    if (r === role) { const b = Math.sin(T * 6) * 3; poly([[sxp - 9, fy - 92 + b], [sxp + 9, fy - 92 + b], [sxp, fy - 78 + b]]); ink('#fff', 3); }
    bobPill(sxp, fy + 30 + (lnV[r] > .5 ? 0 : 0), nameOf(r), col);
  }
  function batonDraw(T, won, lost, rk) {
    const car = carrier(); let bx, by, ang = Math.sin(T * 9) * .25, sc = 1;
    const hand = r => [r * L + pos(r) - camX + 16, LANEY[0] + (LANEY[1] - LANEY[0]) * lnV[r] - 30 - (r === role ? (air > 0 ? Math.sin((1 - air / AIR) * Math.PI) * 52 : 0) : 0)];
    const k = (g.c - flyAt) / .3;
    if (lost && rk >= 0) { const gx = n * L + 120 - camX; bx = gx - 52; by = LANEY[0] - 58 + Math.sin(T * 18) * 2; ang = .2; }
    else if (k >= 0 && k < 1 && flyFrom < n - 1) { const a = hand(flyFrom), b = hand(flyFrom + 1); bx = lerp(a[0], b[0], k); by = lerp(a[1], b[1], k) - Math.sin(k * Math.PI) * 50; ang = k * 9; }
    else { const r = stOf(car) === 0 && car > 0 && !(flyAt > -9 && flyFrom === car - 1) ? car - 1 : car; [bx, by] = hand(r); if (won) by -= 8; }
    X.globalAlpha = 1; baton(bx, by, ang, sc);
    if (flyQ === 2 && k >= 0 && k < 1) { for (let i = 0; i < 3; i++) star(bx - 14 - i * 12, by + (i - 1) * 9, 5, 2, 4, T * 6 + i, '#ffe14d', 1.5); }
  }
  function drawZones(T) {
    for (let j = 0; j < n - 1; j++) {
      const x0 = j * L + Z0[j] - camX, x1 = (j + 1) * L - camX; if (x1 < -20 || x0 > W + OX + 20) continue;
      const on = stOf(j) === 1, pulse = on ? .5 + .2 * Math.sin(T * 8) : .32;
      X.fillStyle = `rgba(92,255,122,${pulse})`; X.fillRect(x0, TR0 + 5, x1 - x0, TR1 - TR0 - 10);
      X.strokeStyle = '#2fc654'; X.lineWidth = 4; X.beginPath(); X.moveTo(x0, TR0 + 5); X.lineTo(x0, TR1 - 5); X.stroke();
      X.fillStyle = 'rgba(255,255,255,.55)'; for (let q = 0; q < 3; q++) { const cx = x0 + 22 + q * 26; if (cx > x1 - 10) break; poly([[cx, 350], [cx + 14, 365], [cx, 380]]); X.fill(); poly([[cx, 424], [cx + 14, 439], [cx, 454]]); X.fill(); }
      X.fillStyle = '#fff'; X.fillRect(x1 - 4, TR0 + 2, 8, TR1 - TR0 - 4); X.strokeStyle = INK; X.lineWidth = 2.5; X.strokeRect(x1 - 4, TR0 + 2, 8, TR1 - TR0 - 4);
      if (on && x1 - x0 > 60) badge('PASS!', (x0 + x1) / 2 - 8, 300 + Math.sin(T * 8) * 3, 18, '#22a447', '#fff', 1, -.03);
    }
  }
  function drawFinish(T, won, rk) {
    const fx = n * L - camX; if (fx < -120 || fx > W + OX + 160) return;
    rr(fx - 6, TR0 - 130, 12, 150, 3); ink('#fff', 3.5); rr(fx - 6, TR1 - 20, 12, 40, 3); ink('#fff', 3.5);
    rr(fx - 110, TR0 - 154, 112, 30, 10); ink('#e8434f', 4); txt('FINISH', fx - 54, TR0 - 139, 20, '#fff', 'center', 96);
    if (!(won && rk > .05)) { X.save(); X.globalAlpha = .9; line([[fx, TR0 + 4], [fx, TR1 - 6]], 7, '#ffe14d'); X.restore(); }
    else { for (const s2 of [-1, 1]) { X.save(); X.translate(fx, s2 < 0 ? TR0 + 4 : TR1 - 6); X.rotate(s2 * (.4 + rk * .5)); line([[0, 0], [0, -s2 * 30]], 7, '#ffe14d'); X.restore(); } }
  }
  g.draw = function () {
    const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
    X = ctx; if (camX === null) camX = 0;
    if (!TILE) TILE = buildTile();
    X.fillStyle = '#e6f8ff'; X.fillRect(-OX, 0, VW, 260);
    const base = -(((camX % 400) + 400) % 400);
    for (let tx = base - 400 * Math.ceil(OX / 400); tx < W + OX; tx += 400) X.drawImage(TILE, tx, 0);
    sky(T, camX);
    drawZones(T);
    // the leg furniture (start/finish lines, hurdles, mud, wind, puddles)
    for (let j = 0; j < n; j++) {
      const wx0 = j * L - camX; if (wx0 > W + OX + 40 || wx0 + L < -OX - 160) continue;
      if (j > 0) { X.fillStyle = 'rgba(255,255,255,.7)'; X.fillRect(wx0 - 3, TR0 + 4, 6, TR1 - TR0 - 8); }
      for (const o of OB[j]) {
        const sx = wx0 + o.x; if (sx > W + OX + 60 || sx + (o.w || 0) < -OX - 60) continue;
        const vis = visible(j, o) || g.result; if (!vis) continue;
        if (o.k === 'hurdle') hurdle(sx, LANEY[0] + 6, o.hit && pos(j) > o.x);
        else if (o.k === 'mud') mudPatch(sx, o.w, LANEY[0] + 4, T);
        else if (o.k === 'wind') windZone(sx, o.w, T, stOf(j) === 1 && pos(j) >= o.x && pos(j) <= o.x + o.w);
        else puddle(sx, o.lane, T);
        if (o.cued && pos(j) < o.x + (o.w || 0) && !g.result) cueMark(sx + (o.w || 0) / 2, o.k === 'puddle' ? LANEY[o.lane] - 24 : LANEY[0] - 60, T);
      }
    }
    // dust bank ahead of me: what I cannot see yet
    if (st === 1 && !g.result && !coachMode()) { const dx = x + SIGHT - camX + L * role; for (let i = 0; i < 5; i++) { const px = dx + 12 + i * 4 + Math.sin(T * 2 + i) * 6, py = TR0 + 20 + i * 28; X.globalAlpha = .55; X.beginPath(); X.arc(px, py, 22 + (i % 2) * 6, 0, TAU); ink('#f4e3c2', 2); X.globalAlpha = 1; } }
    drawFinish(T, won, rk);
    // the goat waits behind the finish line
    { const gx = n * L + 120 - camX; if (gx > -80 && gx < W + OX + 80) goat(gx, LANEY[0] + 20, T, won ? 'happy' : lost ? 'full' : 'calm', lost && rk > .3); }
    for (let r = n - 1; r >= 0; r--) drawRunner(r, T, won, lost, rk);
    batonDraw(T, won, lost, rk);
    for (const b of bits) { const a = (T - b.t0) / .6; X.globalAlpha = 1 - a; X.beginPath(); X.arc(b.x, b.y, 4, 0, TAU); ink(b.c, 1.5); X.globalAlpha = 1; }
    drawHud(T, won, lost, rk);
    for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .8 ? Math.max(0, 1 - (a - .8) / .3) : 1; badge(q.s, clamp(q.wx - camX, 130, 670), q.y - Math.min(a, .6) * 18, q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
    if (won && rk > .15) badge('GOLD MEDAL!', 400, 190, 32, '#22a447', '#fff', outBack((rk - .15) / .22), -.04);
    if (lost && rk > .3) badge('GOAT ATE IT!', 400, 190, 30, '#8a5a33', '#fff', outBack((rk - .3) / .2), .04);
    vignette(.16);
  };
  function drawHud(T, won, lost, rk) {
    // the relay strip: every leg, who runs it, where the baton is (y 66..104)
    const sx0 = 170, sw = 460, sy = 68, seg = sw / n;
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(sx0 + 4, sy + 6, sw, 32, 16); X.fill(); rr(sx0, sy, sw, 32, 16); ink('#fff3dc', 3.5);
    for (let j = 0; j < n; j++) {
      const a = sx0 + j * seg, zs = (Z0[j] / L), c = colOf(j);
      X.fillStyle = c; rr(a + 5, sy + 5, seg - 10, 10, 5); X.fill();
      if (j < n - 1) { X.fillStyle = '#5CFF7A'; X.fillRect(a + 5 + (seg - 10) * zs, sy + 19, (seg - 10) * (1 - zs), 8); }
      if (coachOf(j) === role) for (const o of OB[j]) { X.beginPath(); X.arc(a + 5 + (seg - 10) * o.x / L, sy + 23, 3, 0, TAU); ink(o.cued ? '#ffe14d' : '#fff', 1.5); }
      X.strokeStyle = INK; X.lineWidth = 2; if (j) { X.beginPath(); X.moveTo(a, sy + 4); X.lineTo(a, sy + 28); X.stroke(); }
      const p = clamp(pos(j) / L, 0, 1); if (stOf(j) >= 1 || j === 0) { X.beginPath(); X.arc(a + 5 + (seg - 10) * p, sy + 10, 6, 0, TAU); ink(c, 2.5); }
    }
    // the plate at the bottom
    const done = !!g.result || st === 2 && !coachMode(), py = 478 + (g.result && rk > 0 ? ease(clamp((rk - .1) / .25, 0, 1)) * 120 : 0);
    const inZone = st === 1 && !last && x >= Z0[role] && !passed, tt = T - pressAt < .12;
    if (coachMode()) plate(400, py, 320, 56, '#ffb13d', '#c99512', 'FLASH!', 'SPACE', tt, g.result, (xx, yy) => { poly([[xx - 8, yy - 14], [xx + 12, yy - 14], [xx + 2, yy], [xx + 12, yy], [xx - 8, yy + 16], [xx - 2, yy + 2], [xx - 10, yy + 2]]); ink('#fff', 2.5); });
    else if (inZone) plate(400, py, 320, 56, '#4fd06a', '#24803a', 'PASS!', 'SPACE', tt, false, (xx, yy) => { baton(xx, yy, -.4, 1.1); });
    else if (st === 1) plate(400, py, 320, 56, '#4db8ff', '#2a82c4', kind === 'hurdle' ? 'JUMP!' : kind === 'mud' ? 'MASH!' : kind === 'wind' ? 'HOLD!' : 'DODGE!', kind === 'puddle' ? 'W / S' : 'SPACE', tt, g.result);
    else plate(400, py, 320, 56, '#8f88a6', '#6f6a86', st === 0 ? 'GET READY' : 'CHEER!', null, true, done);
    if (!g.result && T < 4.5) {
      if (coachMode() && role > 0) badge('COACH: FLASH THE NEXT OBSTACLE!', 400, 140, 17, '#c99512', '#fff', 1, -.03);
      else if (st === 1 && T < 3) badge(kind === 'hurdle' ? (TOUCH ? 'TAP TO JUMP!' : 'SPACE TO JUMP!') : kind === 'mud' ? (TOUCH ? 'TAP TAP TAP!' : 'MASH SPACE!') : kind === 'wind' ? (TOUCH ? 'HOLD!' : 'HOLD SPACE!') : (TOUCH ? 'TAP ABOVE / BELOW!' : 'W / S: SWITCH LANE!'), 400, 140, 18, '#2b9ee6', '#fff', 1, -.03);
      else if (role === 0 && T < START) badge('READY...', 400, 140, 22, '#7a5040', '#fff', 1, -.03);
    }
  }
  g.dbg = {
    OB, L, V, n, kind, Z0, pos: r => pos(r === undefined ? role : r), cam: () => camX,
    view: () => {
      const mode = coachMode() ? 'coach' : st === 1 ? 'run' : st === 2 ? 'done' : 'wait', cj = coached, cp = pos(cj);
      return {
        mode, st, x, L, V, Z0: Z0[role], last, passed, lane: Math.round(laneV), laneTgt, laneY: LANEY[Math.round(laneV)], laneYOf: l => LANEY[l],
        obs: LEG.filter(o => visible(role, o) && o.x + (o.w || 0) >= x - 4).map(o => ({ i: o.i, k: o.k, x: o.x, w: o.w, lane: o.lane })),
        coach: mode === 'coach' ? { j: cj, x: cp, st: stOf(cj), next: stOf(cj) === 1 ? (OB[cj].find(o => !o.cued && o.x + (o.w || 0) > cp - 10) || null) : null } : null,
      };
    },
  };
  wire(g, D, 0, sp, 'sq_relay');
  return g;
}
reg('sq_relay', relay, 'RELAY RACE'); REGMAP.sq_relay.duo = true; REGMAP.sq_relay.squad = true;

/* ───────────── intro card (520×240 frame): what each role does, a 3.6 s loop ───────────── */
DUO.INFO.sq_relay = n => [
  ['HURDLES', 'JUMP THE HURDLES, PASS THE BATON', 'CLICK / SPACE'],
  ['MUD', 'WADE THROUGH THE MUD, PASS THE BATON', 'MASH CLICK / SPACE'],
  ['WIND', 'LEAN INTO THE GUSTS, PASS THE BATON', 'HOLD CLICK / SPACE'],
  ['PUDDLES', 'DODGE THE PUDDLES, PASS THE BATON', 'MOUSE UP / DOWN OR W / S'],
].slice(0, n);
function demo(k, t) {
  X = ctx; const u = t % 3.6, FY = 170, rx = 150;
  let gr = X.createLinearGradient(0, 0, 0, 100); gr.addColorStop(0, '#79d4ff'); gr.addColorStop(1, '#e6f8ff'); X.fillStyle = gr; X.fillRect(0, 0, 520, 100);
  X.fillStyle = '#8a74e0'; X.fillRect(0, 50, 520, 50); for (let i = 0; i < 14; i++) { X.beginPath(); X.arc(18 + i * 38, 70 + (i % 2) * 14, 8, 0, TAU); ink(['#ff7aa8', '#ffd23f', '#6EA8FE', '#5CFF7A'][i % 4], 2.5); }
  X.fillStyle = '#5ccf6a'; X.fillRect(0, 100, 520, 30); gr = X.createLinearGradient(0, 130, 0, 240); gr.addColorStop(0, '#ee8450'); gr.addColorStop(1, '#d4653c'); X.fillStyle = gr; X.fillRect(0, 130, 520, 110);
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 130); X.lineTo(520, 130); X.stroke(); X.strokeStyle = '#fff'; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 185); X.lineTo(520, 185); X.stroke();
  const ox = 600 - u * 190; let hop = 0, mood = null, bmsg = '', bcol = '#2b9ee6';
  if (k === 'hurdle') { hurdle(ox, FY + 6, false); const near = clamp(1 - Math.abs(ox - rx) / 90, 0, 1); hop = Math.sin(near * Math.PI) * 44; bmsg = near > 0 ? 'JUMP!' : 'TAP!'; demoFinger(430, 210, near > .2 && near < .9, near); }
  else if (k === 'mud') { mudPatch(rx - 60 + (u < 2.4 ? 0 : -((u - 2.4) * 160)) + 40, 150, FY + 4, t); const tapK = (t * 5) % 1; bmsg = 'MASH!'; demoFinger(430, 210, tapK < .45, tapK * 2); }
  else if (k === 'wind') { windZone(rx + 20, 300, t, true); bmsg = 'HOLD!'; demoFinger(430, 210, true, 0); }
  else { const lane = Math.sin(t * 2) > 0 ? 1 : 0; puddle(ox, 0, t); bmsg = 'DODGE!'; demoFinger(430, 150 + lane * 60, true, 0); hop = 0; mood = null; }
  const ry = FY - hop, lane = k === 'puddle' ? (Math.abs(ox - rx) < 90 ? 1 : 0) : 0;
  shadow(rx, FY + 3, 22, 6, .25);
  caos(rx, ry + lane * 40 - (k === 'puddle' ? 8 : 0), 3.2, { col: DEF[0], mood, run: t * .9 });
  baton(rx + 18, ry - 30 + lane * 40, Math.sin(t * 9) * .25);
  const gx = 400; X.fillStyle = 'rgba(92,255,122,.45)'; X.fillRect(gx - 90, 134, 100, 100); X.strokeStyle = '#2fc654'; X.lineWidth = 3; X.strokeRect(gx - 90, 134, 100, 100);
  caos(gx + 40, FY + 8, 3.2, { col: DEF[1] }); txt('PASS!', gx - 40, 118, 18, '#fff');
  badge(bmsg, 260, 34, 18, '#2b9ee6', '#fff', 1, -.03);
}
DUO.DEMOS.sq_relay = n => Array.from({ length: n }, (_, r) => t => demo(KIND[r], t));

})();
