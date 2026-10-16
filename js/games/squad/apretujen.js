'use strict';
/* ═════════ SQUAD · ¡APRETUJEN! (sq_apretujen) ═════════
   A por puesto rattling through Caracas, drawn as a side cutaway packed like sardines. The team has to reach the PARADA with >= 8 aboard
   without tipping the bus. Seats:
     0 COLECTOR (JUDGE) hangs off the rear door and taps to pull the next runner of the curb queue aboard (each one kicks the bench they land on).
     1 REAR BENCH / 2 FRONT BENCH each own one bench: a pile position p (-1 rear .. +1 front). Hold ◄ ► / drag to shuffle the bodies.
     3 CHOFER (4 seats only) steers the lane through the potholes; only he sees the road, everybody else only feels the bounce.
   Weight is one shared scalar: tilt = w0*p0 + w1*p1 (w grows with the load of each bench). A tilted bus slides the piles downhill, the bus is unstable by
   itself and the arrivals / potholes kick the piles. Fail: |tilt| > .6 for > 1 s (wheelie / nosedive), a pile at the window for .7 s (bodies pour out
   like toothpaste), 3 potholes hit (flat tire, 4 seats) or fewer than 8 aboard at the stop.
   Netcode: every seat owns its own variable and publishes coalesced updates: 'p' (bench pile), 'lane' (chofer), 'in' (judge: queue index pulled aboard),
   'bump' (chofer: pothole index hit). The level (queue, potholes, drift) comes from the seeded mkR() so every screen sees the same world.
   The judge calls g.finish('win'|'lose') before g.limit. Win = 14 people and a gallina on the roof, ¡UEPA!. */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;

/* ───────────── layout (800x600; HUD keeps y<58, the top-left box, the top-right corner and y>552) ───────────── */
const GY = 446, FLOOR = 394, BX0 = 186, BX1 = 706, REAR = 306 - 30, FRONT = 626;   // ground, bus floor, body x range, wheel centres
const NEED = 8, TIPPED = .6, QLEN = 14, HITS = 3, SPILL = .93;
const A_ = .36, B_ = .85, KU = 2.7;                  // pile dynamics: instability, downhill slide, hand authority
const BENCH = [{ cx: 318, half: 104 }, { cx: 538, half: 94 }];
const COLS = ['#FFC93C', '#6EA8FE', '#FF8FB1', '#7CE08A'];
const PCOL = ['#FF6B3D', '#8fb7ff', '#ffd166', '#b6e388', '#f49ac2', '#c9b6ff', '#7fe0d0', '#ff9a9a'];
const BUS = '#ffb02e', BUS2 = '#d98410', GRN = '#2fa86b', RED = '#d9435a', CREAM = '#fff2c6', ASPH = '#5a566e';
const el = (x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); };
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function ink(fill, o = 4) { ctx.lineJoin = 'round'; ctx.lineCap = 'round'; if (o) { ctx.lineWidth = o * 2; ctx.strokeStyle = INK; ctx.stroke(); } if (fill) { ctx.fillStyle = fill; ctx.fill(); } }
function line(pts, w, col) { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.strokeStyle = INK; ctx.lineWidth = w + 5; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); }
function tri(x1, y1, x2, y2, x3, y3, fill, o = 3) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ink(fill, o); }
function glint(x, y, rx, ry, a = .5) { ctx.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, -.5); ctx.fill(); }
function badge(s, x, y, size, bgc, fg, sc, rot) {
  if (sc <= .01) return;
  ctx.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(280, ctx.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(sc, sc);
  ctx.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); ctx.fill();
  rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
  ctx.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); ctx.fill();
  txt(s, 0, 2, size, fg || '#fff', 'center', 280);
  ctx.restore();
}
function pill(x, y, label, col, size = 16) {
  ctx.font = `700 ${size}px Fredoka, "Helvetica Neue", Arial, sans-serif`; const w = Math.min(170, ctx.measureText(t(label)).width + 26), h = size + 12;
  rr(x - w / 2, y - h / 2, w, h, h / 2); ink(col, 3); ctx.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - h / 2 + 3, w - 12, h * .24, h * .12); ctx.fill();
  txt(label, x, y + 1, size, INK, 'center', w - 14);
}
function keycap(x, y, dir, on, big) {
  const s = big ? 64 : 50; ctx.save(); ctx.translate(x, y + (on ? 4 : 0)); ctx.globalAlpha = big ? .85 : 1;
  rr(-s / 2, -s / 2 + (on ? 0 : -5), s, s, 10); ink(on ? '#ffe14d' : '#fff', 4); ctx.fillStyle = 'rgba(0,0,0,.14)'; rr(-s / 2 + 4, s / 2 - 12 + (on ? 0 : -5), s - 8, 8, 4); ctx.fill();
  tri(dir * 14, -5, -dir * 10, -19, -dir * 10, 9, INK, 0); ctx.fillStyle = INK; ctx.fill(); ctx.restore();
}
function arrowCue(x, y, dir, k, T) {
  const s = 1 + Math.sin(T * 14) * .1, r = 16 + 14 * k;
  ctx.save(); ctx.translate(x + dir * Math.sin(T * 14) * 3, y); ctx.scale(s, s);
  tri(dir * r * 1.3, 0, -dir * r * .2, -r, -dir * r * .2, r, k > .6 ? '#ff3d3d' : '#ffe14d', 4); ctx.restore();
}
const hash = k => { let h = (k * 2654435761) >>> 0; h ^= h >>> 15; return (h % 1000) / 1000; };

/* ───────────── the street (parallax, scrolls left while the bus rolls) ───────────── */
const HOUSES = []; for (let i = 0; i < 14; i++) HOUSES.push({ w: 70 + hash(i) * 50, h: 70 + hash(i + 40) * 110, c: ['#ff7aa8', '#7fd0ff', '#ffd166', '#9be37a', '#c9a0ff', '#ff9a5c'][i % 6], x: i * 118 });
function street(sx, T, prog) {
  const g1 = ctx.createLinearGradient(0, 0, 0, 360); g1.addColorStop(0, '#6cc8ff'); g1.addColorStop(1, '#ffeab0'); ctx.fillStyle = g1; ctx.fillRect(-OX, 0, VW, 400);
  ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(660, 94, 34, 0, TAU); ctx.fill();              // sun
  // el Avila: the mountain, slow
  const mo = -(sx * .08) % 700; ctx.fillStyle = '#4f9a74'; ctx.beginPath(); ctx.moveTo(-OX, 330);
  for (let k = -1; k < 3; k++) { const x0 = mo + k * 700; ctx.lineTo(x0 + 120, 250); ctx.lineTo(x0 + 240, 290); ctx.lineTo(x0 + 400, 200); ctx.lineTo(x0 + 520, 270); ctx.lineTo(x0 + 700, 330); }
  ctx.lineTo(W + OX, 400); ctx.lineTo(-OX, 400); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
  // ranchitos climbing the hill
  const ho = -(sx * .35) % 1652;
  for (const h of HOUSES) for (let r = 0; r < 2; r++) {
    const x = ((h.x + ho + r * 1652) % 1652 + 1652) % 1652 - 200; if (x < -OX - 140 || x > W + OX + 20) continue;
    const y = 380 - h.h * (r ? .55 : 1) + (r ? 20 : 0), w = h.w, hh = h.h * (r ? .55 : 1);
    ctx.beginPath(); ctx.rect(x, y, w, 380 - y + 20); ink(h.c, 3.5);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x + w * .62, y + 3, w * .38 - 3, 380 - y + 14);
    ctx.fillStyle = INK; for (let wy = y + 16; wy < 360; wy += 30) for (let wx = x + 12; wx < x + w - 16; wx += 24) ctx.fillRect(wx, wy, 10, 14);
    ctx.beginPath(); ctx.rect(x - 4, y - 8, w + 8, 10); ink('#8f8aa3', 3);
  }
  // palms
  const po = -(sx * .7) % 520;
  for (let k = -1; k < 3; k++) {
    const x = po + k * 520 + 120; ctx.fillStyle = INK; ctx.fillRect(x - 6, 270, 12, 150); ctx.fillStyle = '#b07a44'; ctx.fillRect(x - 3, 270, 6, 150);
    for (let l = 0; l < 6; l++) { const an = -Math.PI * (.1 + l * .16) - .1; line([[x, 270], [x + Math.cos(an) * 56, 270 + Math.sin(an) * 40 + 12]], 6, '#3fa14a'); }
  }
  // a billboard of the arepa kingdom, coming up with the stop
  const bx = ((-sx * .9) % 1300 + 1300) % 1300 - 160;
  if (bx > -OX - 220 && bx < W + OX) { ctx.fillStyle = INK; ctx.fillRect(bx + 30, 330, 10, 90); ctx.fillRect(bx + 150, 330, 10, 90); rr(bx, 276, 190, 70, 8); ink('#fff', 4); txt('AREPAS', bx + 95, 312, 34, '#e8343d', 'center', 170); }
  // sidewalk and road
  ctx.fillStyle = '#bdb6cf'; ctx.fillRect(-OX, 400, VW, 24); ctx.fillStyle = INK; ctx.fillRect(-OX, 422, VW, 5);
  ctx.fillStyle = ASPH; ctx.fillRect(-OX, 427, VW, H - 427);
  ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(-OX, 427, VW, 8);
  const dx = -(sx % 160); ctx.fillStyle = '#ffd23f'; for (let x = dx - 160; x < W + OX + 160; x += 160) ctx.fillRect(x, 530, 80, 9);
  // sidewalk gag: the empanada man runs alongside with his tray
  const ex = 70 + Math.sin(T * 1.3) * 12; const ey = 424;
  caos(ex, ey, 2.3, { col: '#fff', run: T * .35 });
  rr(ex - 22, ey - 40, 44, 8, 3); ink('#e9a64c', 2.5); for (let k = 0; k < 3; k++) { el(ex - 13 + k * 13, ey - 45, 7, 5); ink('#ffd98a', 2); }
  if (hash(Math.floor(T * 1.6)) > .6) txt('EMPANADAS!', ex + 6, ey - 66, 15, '#ffe14d', 'center', 120);
  // a moto with the whole family drifts across once
  const mk = (T - 4.5) / 3.6; if (mk > 0 && mk < 1) {
    const mx = W + 120 - mk * (W + 360), my = 478 + Math.sin(T * 30) * .8;
    ctx.save(); ctx.translate(mx, my); for (const wx of [-26, 26]) { ctx.beginPath(); ctx.arc(wx, 0, 15, 0, TAU); ink('#3a3550', 3); ctx.beginPath(); ctx.arc(wx, 0, 5, 0, TAU); ink('#ddd', 1.5); }
    ctx.beginPath(); ctx.rect(-24, -22, 50, 16); ink('#e8343d', 3);
    for (let k = 0; k < 4; k++) caos(-22 + k * 15, -20 - (k % 2) * 3, 1.5, { col: PCOL[(k + 2) % 8] }); ctx.restore();
  }
}

/* ───────────── the bus, in its own frame (feet on FLOOR, drawn under the tilt rotation) ───────────── */
function wheel(x, y, rot) {
  ctx.beginPath(); ctx.arc(x, y, 31, 0, TAU); ink('#2a2638', 4);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 4); line([[-17, 0], [17, 0]], 3, '#cfc9e0'); } ctx.restore();
  ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ink('#ffd23f', 2.5);
}
function person(x, y, u, col, mood, bag, T, sweatK) {
  caos(x, y, u, { col, mood });
  if (bag) { rr(x + 5 * u, y - 5 * u, 5.5 * u, 5 * u, 2); ink('#c99a5b', 2.5); line([[x + 6 * u, y - 5 * u], [x + 8 * u, y - 8 * u], [x + 10 * u, y - 5 * u]], 1.2, '#8a5a3c'); }
  if (sweatK > .1 && mood !== 'sad') { const k = (T * 2.4 + x * .03) % 1; ctx.globalAlpha = (1 - k) * Math.min(1, sweatK * 1.4); ctx.beginPath(); ctx.arc(x + 7 * u, y - 9 * u + k * 6 * u, .7 * u, 0, TAU); ink('#7fd8ff', 1.5); ctx.globalAlpha = 1; }
}
function chicken(x, y, T, sc, dir, flap) {                 // the gallina: a red-combed ball of feathers
  ctx.save(); ctx.translate(x, y); ctx.scale(sc * dir, sc);
  const w = Math.sin(T * 30) * flap;
  ctx.save(); ctx.rotate(-.6 - w * .5); ctx.beginPath(); ctx.ellipse(-4, -8, 16, 8, 0, 0, TAU); ink('#fff0e0', 3); ctx.restore();
  el(0, 0, 17, 13); ink('#ffffff', 3.5); glint(-5, -5, 5, 3, .7);
  ctx.beginPath(); ctx.arc(14, -12, 8, 0, TAU); ink('#ffffff', 3); tri(21, -13, 29, -10, 21, -8, '#ffb02e', 2);
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(10 + k * 4, -20 + (k % 2) * 2, 3.2, 0, TAU); ink('#e8343d', 2); }
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(16, -13, 1.9, 0, TAU); ctx.fill();
  tri(-15, -4, -26, -12, -22, 2, '#ffd0a0', 2.5);
  ctx.restore();
}

/* ═════════ the game ═════════ */
function sqApretujen(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), n = D.roles === 4 ? 4 : 3, me = D.role, TS = Math.sqrt(sp), judge = me === 0;
  /* the level: identical on every screen whatever n / role (every R() draw is unconditional) */
  const Q = [];
  for (let i = 0; i < QLEN; i++) {
    const kind = R() < .22 ? 3 : R() < .4 ? 2 : R() < .55 ? 1 : 0;           // 0 person, 1 person + bag, 2 kid, 3 big señora
    const bn = R() < .5 ? 0 : 1, sg = R() < .5 ? -1 : 1, col = Math.floor(R() * 8);
    Q.push({ kind, bench: bn, w: [1, 1.3, .6, 1.5][kind], kick: sg * (.14 + .08 * [1, 1.3, .6, 1.5][kind]), col });
  }
  for (let i = 0; i < 8; i++) Q[i].bench = (i + (Q[0].bench)) % 2;               // the first eight alternate: both benches get load early
  const DR = [0, 1].map(() => ({ f1: 1.2 + R() * .8, p1: R() * TAU, f2: 2.4 + R() * 1.2, p2: R() * TAU, a: .2 + R() * .06 }));
  const PX = [.5, .2, .5, .8, .5], PH = PX.map((x, e) => ({ i: e, s0: 2.7 + e * 2.6 + (R() - .5) * .6, x: clamp(x + (R() - .5) * .08, .08, .92), k: .55 + R() * .25, kd: [R() < .5 ? -1 : 1, R() < .5 ? -1 : 1], auto: e % 2 === 0, done: false }));
  const GA = { fx: .9 + R() * .5, fy: 1.6 + R() * .8, ph: R() * TAU };
  const SEND = 17 - .6 * TS;                                                        // sim seconds the ride lasts
  /* state */
  let p = 0, lane = .5, u = 0, keyL = 0, keyR = 0, ptrOn = false, ptrX = 400, botOn = false, botU = 0, S = 0, sx = 0, over = 0, hits = 0;
  let resAt = -1, why = '', whyAt = -9, lastSent = '', sentAt = -9, lastLane = '', laneAt = -9, bumpAt = -9, bumpK = 0, pull = 0, tapAt = -9, cool = 0, dodgeAt = -9, endFx = false;
  const spill = [0, 0], aT = [track(), track(), track(), track()], aboard = [];             // aboard: { q, t0, slot }
  const cols = i => (D.byRole[i] && D.byRole[i].color) || COLS[i], name = i => (D.byRole[i] && D.byRole[i].name) || 'P' + (i + 1);
  const pops = [], fx = [];
  const load = j => { let L = 0; for (const a of aboard) if (a.q.bench === j) L += a.q.w; return L; };
  const wOf = j => clamp(.15 + .1 * load(j), .15, 1);
  const pOf = j => me === j + 1 ? p : (aT[j + 1].at() || 0);
  const tiltNow = () => clamp(wOf(0) * pOf(0) + wOf(1) * pOf(1), -1.3, 1.3);
  function pop(s, x, y, size, bgc) { pops.push({ s, x, y, size, bgc, t0: g.c }); if (pops.length > 3) pops.shift(); }
  function board(qi) {
    if (qi < 0 || qi >= QLEN || aboard.some(a => a.q === Q[qi])) return;
    aboard.push({ q: Q[qi], t0: g.c, qi }); const q = Q[qi]; pull = Math.max(pull, qi + 1);
    if (me === q.bench + 1) p = clamp(p + q.kick, -1, 1);
    snd(300 + q.bench * 120, .07, 'square', .05, 0, 520); shake(2, .08);
  }
  function why_(s) { if (!why) { why = s; whyAt = g.c; } }
  function bump(e, mine) {
    if (e.done && !mine) return; e.done = true; bumpAt = g.c; bumpK = e.k;
    if (me === 1 || me === 2) p = clamp(p + e.kd[me - 1] * .3 * e.k, -1, 1);
    snd(120, .16, 'sawtooth', .08, 0, 60); noise(.12, .08, 200, 900, 'lowpass'); shake(4, .15);
  }
  function fail(s) { why_(s); if (judge && !g.result) g.finish('lose'); }

  const g = {
    c: 0, dur: 17, pts: 0,
    cmd: ['PULL!', 'SHIFT!', 'SHIFT!', 'DRIVE!'][me], roleLabel: ['COLLECTOR', 'REAR BENCH', 'FRONT BENCH', 'DRIVER'][me],
    hint: me === 0 ? 'TAP / CLICK / SPACE TO PULL PEOPLE ABOARD - AT LEAST 8 BEFORE THE STOP, WITHOUT TIPPING THE BUS'
      : me < 3 ? 'HOLD ◄ ► (OR A / D) TO SHUFFLE YOUR BENCH - KEEP THE NEEDLE IN THE MIDDLE'
        : 'HOLD ◄ ► (OR A / D) TO STEER - DODGE THE POTHOLES, EVERYBODY ELSE ONLY FEELS THEM',
    thint: me === 0 ? 'TAP THE DOOR TO PULL PEOPLE ABOARD - AT LEAST 8 BEFORE THE STOP, WITHOUT TIPPING THE BUS'
      : me < 3 ? 'HOLD THE LEFT / RIGHT SIDE TO SHUFFLE YOUR BENCH - KEEP THE NEEDLE IN THE MIDDLE'
        : 'HOLD THE LEFT / RIGHT SIDE TO STEER - DODGE THE POTHOLES, EVERYBODY ELSE ONLY FEELS THEM',
    update(dt) {
      dt = Math.min(dt, .05); g.c += dt; cool = Math.max(0, cool - dt);
      if (g.result && resAt < 0) { resAt = g.c; if (!why) { const tl = tiltNow(); why_(aboard.length < NEED ? 'TOO FEW!' : hits >= HITS ? 'FLAT TIRE!' : Math.abs(tl) > .35 ? (tl < 0 ? 'WHEELIE!' : 'NOSEDIVE!') : 'SPILLED!'); } }
      const done = !!g.result;
      const tu = botOn ? botU : keyL || keyR ? keyR - keyL : ptrOn ? clamp((ptrX - 400) / 130, -1, 1) : 0;
      u += (tu - u) * Math.min(1, dt * 16);
      const prog = clamp(g.c / g.limit, 0, 1), spd = prog < .84 ? 1 : 1 - ease((prog - .84) / .16);
      sx += 260 * spd * dt * (done && g.result === 'lose' ? .4 : 1);
      if (!done) {
        const dS = dt * TS; S += dS;
        if (me === 1 || me === 2) {
          const j = me - 1, d = DR[j], dr = d.a * (Math.sin(d.f1 * S + d.p1) + .6 * Math.sin(d.f2 * S + d.p2));
          p = clamp(p + (A_ * p + B_ * tiltNow() + dr + KU * u) * dS, -1, 1);
          const m = Math.round(p * 1000);
          if (m !== lastSent && g.c - sentAt >= .09) { lastSent = m; sentAt = g.c; D.send('p', m, true); }
        } else if (me === 3) {
          lane = clamp(lane + u * .95 * dS, 0, 1);
          const m = Math.round(lane * 1000);
          if (m !== lastLane && g.c - laneAt >= .09) { lastLane = m; laneAt = g.c; D.send('lane', m, true); }
        }
        for (const e of PH) {                                                       // potholes: the driver decides (4 seats), else the auto-pilot clips every other one
          if (e.done || S < e.s0) continue;
          if (n === 4) {
            if (me === 3) { e.done = true; if (Math.abs(lane - e.x) < .17) { hits++; D.send('bump', e.i); bump(e, true); if (hits >= HITS) why_('FLAT TIRE!'); } else { dodgeAt = g.c; snd(880, .06, 'triangle', .04); } }
          } else if (e.auto) bump(e, false); else e.done = true;
        }
        if (judge) {
          const tl = tiltNow(); over = Math.abs(tl) > TIPPED ? over + dt : 0;
          for (const j of [0, 1]) spill[j] = load(j) > 0 && Math.abs(pOf(j)) > SPILL ? spill[j] + dt : 0;
          if (over > 1) fail(tl < 0 ? 'WHEELIE!' : 'NOSEDIVE!');
          else if (spill[0] > .7 || spill[1] > .7) fail('SPILLED!');
          else if (hits >= HITS) fail('FLAT TIRE!');
          else if (g.c >= g.limit) { if (aboard.length >= NEED) g.finish('win'); else fail('TOO FEW!'); }
        } else { const tl = tiltNow(); over = Math.abs(tl) > TIPPED ? over + dt : 0; }
      } else {
        if (g.result === 'lose' && !endFx) { endFx = true; sfx.miss(); snd(330, .5, 'sawtooth', .06, 0, 110); shake(7, .25); noise(.4, .1, 300, 1800, 'lowpass'); }
        if (g.result === 'win' && !endFx) { endFx = true; snd(523, .14, 'triangle', .07); snd(659, .14, 'triangle', .07, .12); snd(784, .3, 'triangle', .07, .24); noise(.2, .05, 1500, 3500, 'bandpass', .1); }
      }
      while (pops.length && g.c - pops[0].t0 > 1.1) pops.shift();
    },
    msg(type, d, from) {
      if (type === 'p' && from >= 1 && from <= 2) aT[from].push(d / 1000);
      else if (type === 'lane' && from === 3) aT[3].push(d / 1000);
      else if (type === 'in') board(d);
      else if (type === 'bump' && PH[d]) { hits++; bump(PH[d], false); }
    },
    tilt(v) { botOn = true; botU = clamp(v, -1, 1); },
    pullIn() {
      if (!judge || g.result || cool > 0 || pull >= QLEN) return false;
      cool = .22; tapAt = g.c; board(pull); D.send('in', pull - 1); return true;
    },
    draw(t) {
      const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1, prog = clamp(T / g.limit, 0, 1);
      const tl = lost || won ? (won ? 0 : (why === 'WHEELIE!' ? -1 : why === 'NOSEDIVE!' ? 1 : tiltNow())) : tiltNow();
      street(sx, T, prog);
      // the PARADA sign grows from the right as we arrive
      if (prog > .55) { const k = clamp((prog - .55) / .4, 0, 1), px = lerp(W + OX + 80, 770, ease(k)); ctx.fillStyle = INK; ctx.fillRect(px - 6, 300, 12, 124); rr(px - 54, 262, 108, 50, 8); ink('#2b9ee6', 4); txt('PARADA', px, 288, 22, '#fff', 'center', 96); }
      // the bus: tilt about the axle that stays on the ground
      const ang = tl * .3 + (lost && rk > 0 ? Math.sign(tl || 1) * ease(rk / .5) * .25 : 0), px0 = ang < 0 ? REAR : FRONT;
      const bounce = Math.max(0, 1 - (T - bumpAt) / .45) * bumpK * Math.sin((T - bumpAt) * 40) * 6 + Math.sin(T * 17) * 1.3 * (won ? 0 : 1) + (won && rk > 0 ? -Math.abs(Math.sin(rk * 10)) * 10 : 0);
      ctx.save(); ctx.translate(px0, GY - 4); ctx.rotate(ang); ctx.translate(-px0, -(GY - 4) + bounce);
      drawBus(T, tl, won, lost, rk);
      ctx.restore();
      // runners hailing the bus on the left
      for (let k = 0; k < 3; k++) {
        const qi = pull + k; if (qi >= QLEN) break; const q = Q[qi], rx = 120 - k * 38 + Math.sin(T * 3 + k) * 4;
        person(rx, 428, 2.6 - k * .2, PCOL[q.col], lost ? 'sad' : won ? 'happy' : null, q.kind === 1, T, 0);
        ctx.save(); ctx.translate(rx + 12, 428 - 34 - k * 4); ctx.rotate(Math.sin(T * 12 + k) * .3); line([[0, 0], [6, -12]], 3, '#fff'); ctx.restore();
      }
      if (Q.length - pull > 3) pill(40, 380, `+${QLEN - pull - 3}`, '#ffe14d', 15);
      hud(T, prog, tl, won, lost, rk);
      for (const q of pops) { const aa = T - q.t0; badge(q.s, q.x, q.y - aa * 20, q.size, q.bgc, '#fff', aa < .2 ? outBack(aa / .2) : 1); }
      if (!g.result && T < 2.6) badge(me === 0 ? 'PULL THEM IN!' : me === 3 ? 'DODGE THE HOLES!' : 'BALANCE THE BUS!', 560, 210, 20, me === 0 ? '#22a447' : '#2b9ee6', '#fff', 1, -.03);
      if (won && rk > .15) badge('HOORAY!', 400, 170, 38, '#22a447', '#fff', outBack((rk - .15) / .25), -.04);
      if (lost && rk > .3) badge(why || 'SPILLED!', 400, 170, 32, '#e8343d', '#fff', outBack((rk - .3) / .25), .04);
      vignette(.14);
    },
    down(pt) {
      if (judge) { if (g.pullIn()) { } return; }
      ptrOn = true; ptrX = pt.x;
    },
    move(pt) { if (ptrOn) ptrX = pt.x; },
    up() { ptrOn = false; },
    key(e) {
      if (judge) { if (e.code === 'Space' || e.code === 'Enter' || e.code.startsWith('Arrow') || e.code === 'KeyA' || e.code === 'KeyD' || e.code === 'KeyS' || e.code === 'KeyW') g.pullIn(); return; }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keyL = 1; else if (e.code === 'ArrowRight' || e.code === 'KeyD') keyR = 1;
    },
    keyup(e) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') keyL = 0; else if (e.code === 'ArrowRight' || e.code === 'KeyD') keyR = 0; },
  };

  /* ───── one bus, in its local frame ───── */
  function drawBus(T, tl, won, lost, rk) {
    const wr = sx / 31;
    const sink = lost && rk > 0 ? Math.min(1, rk / .5) : 0;
    wheel(REAR, GY - 31, wr); wheel(FRONT, GY - 31, wr);
    // rear step + body
    rr(BX0 - 30, FLOOR + 4, 40, 10, 3); ink('#8d89a8', 3);
    rr(BX0, 226, BX1 - BX0, 176, 24); ink(BUS, 5);
    ctx.fillStyle = BUS2; ctx.fillRect(BX0 + 4, 390, BX1 - BX0 - 8, 10);
    ctx.fillStyle = GRN; ctx.fillRect(BX0 + 4, 360, BX1 - BX0 - 8, 24); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(BX0 + 4, 362, BX1 - BX0 - 8, 5);
    rr(BX1 - 20, 300, 74, 102, 18); ink(BUS, 5); rr(BX1 + 18, 340, 22, 24, 6); ink('#fff6b0', 3);      // hood + headlight
    // interior (cutaway): cream wall, windows, floor
    rr(BX0 + 14, 242, BX1 - BX0 - 8, 148, 12); ink(CREAM, 4); ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(BX0 + 18, 372, BX1 - BX0 - 16, 18);
    for (let i = 0; i < 7; i++) { rr(BX0 + 34 + i * 70, 252, 54, 44, 8); ink('#bfe8ff', 3); glint(BX0 + 46 + i * 70, 262, 9, 4, .6); }
    // benches (the bus floor shows through)
    for (let j = 0; j < 2; j++) { const b = BENCH[j]; rr(b.cx - b.half, 366, b.half * 2, 26, 6); ink(['#8a5a3c', '#7a4a6c'][j], 3.5); glint(b.cx - b.half + 18, 372, 14, 3, .35); }
    // the chofer at the wheel
    const lx = me === 3 ? lane : (aT[3].at() === null ? .5 : aT[3].at());
    const dx = n === 4 ? (lx - .5) * 14 : Math.sin(T * 1.7) * 3;
    caos(BX1 - 18 + dx, FLOOR - 2, 3.1, { col: cols(3), mood: won ? 'happy' : lost ? 'sad' : null });
    ctx.save(); ctx.translate(BX1 + 4, 330); ctx.rotate((lx - .5) * 1.8 + Math.sin(T * 9) * .04); line([[-12, 0], [12, 0]], 4, '#2a2638'); line([[0, -12], [0, 12]], 4, '#2a2638'); ctx.restore();
    if (n === 4) { ctx.save(); ctx.translate(BX1 - 18 + dx, FLOOR - 52); ctx.restore(); }
    // passengers: pile positions come from the owner of each bench
    const slotN = [0, 0];
    for (const a of aboard) {
      const j = a.q.bench, k = slotN[j]++, b = BENCH[j], pj = clamp(pOf(j), -1, 1), row = k >= 4 ? 1 : 0, c = k % 4;
      const squash = Math.abs(pj) > .8 ? 1 - (Math.abs(pj) - .8) * 1.2 : 1;
      let x = b.cx + pj * 38 + (c - 1.5) * 30 * squash + row * 14, y = FLOOR - 4 - row * 17, u = 3 - row * .35;
      x = clamp(x, BX0 + 40, BX1 - 50);
      let mood = won ? 'happy' : lost ? 'sad' : null, ph = T - a.t0;
      if (ph < .34) { const f = ph / .34; x = lerp(BX0 - 8, x, ease(f)); y = lerp(FLOOR, y, f) - Math.sin(f * Math.PI) * 54; }
      if (lost && rk > 0) {                                                     // toothpaste: everybody squirts out through the windows, stretching
        const f = clamp((rk - .1 - hash(k + j * 9) * .3) / .6, 0, 1), side = hash(k * 7 + j) < .5 ? -1 : 1;
        if (f > 0) { const ex = x + side * 40 * f, ey = lerp(y, 262, Math.min(1, f * 1.6)) - f * f * 10; ctx.save(); ctx.translate(ex, ey); ctx.scale(1 - f * .3, 1 + f * .8); ctx.translate(-ex, -ey); caos(ex, ey + 20, u, { col: PCOL[a.q.col], mood: 'sad' }); ctx.restore(); continue; }
      }
      const stress = clamp(Math.abs(tl) - .3, 0, .3) / .3 + (Math.abs(pj) > .85 ? 1 : 0);
      person(x, y, u, PCOL[a.q.col], mood, a.q.kind === 1, T, stress);
      if (a.q.kind === 3) { rr(x - 12, y - 33, 24, 6, 3); ink('#ff5c8a', 2.5); }    // the señora's hair curlers
      if (a.q.kind === 2) { ctx.beginPath(); ctx.arc(x, y - 33, 3, 0, TAU); ink('#4db8ff', 2); }
    }
    // the gallina: panics through the cabin, perches on the roof when we win, keeps flying when we don't
    let cx = 430 + Math.sin(T * GA.fx + GA.ph) * 190, cy = 308 + Math.sin(T * GA.fy) * 28 - Math.abs(Math.sin(T * 6)) * 6, cdir = Math.cos(T * GA.fx + GA.ph) > 0 ? 1 : -1, fl = 5;
    if (won && rk > 0) { const f = ease(rk / .5); cx = lerp(cx, 440, f); cy = lerp(cy, 190 - 6, f); cdir = 1; fl = (1 - f) * 5; }
    else if (lost && rk > 0) { cx = cx + rk * 150; cy = cy - rk * 60 + Math.sin(rk * 8) * 18; cdir = 1; }
    // colector hanging off the rear door
    const ck = Math.max(0, 1 - (T - tapAt) / .25);
    ctx.save(); ctx.translate(BX0 - 30, FLOOR + 4); ctx.rotate(-.18 - ck * .1);
    caos(0, 0, 3.1, { col: cols(0), mood: won ? 'happy' : lost ? 'sad' : null });
    line([[7, -22], [20 + ck * 6, -34 - ck * 4]], 5, cols(0));                       // arm waving the next one in
    ctx.restore();
    // roof rack + people on the roof (win payoff: fourteen people and a gallina)
    rr(BX0 + 30, 214, BX1 - BX0 - 70, 12, 4); ink('#8d89a8', 3);
    if (won && rk > 0) {
      const roof = Math.max(0, QLEN - aboard.length);
      for (let i = 0; i < roof; i++) { const f = clamp((rk - .1 - i * .08) / .3, 0, 1); if (f <= 0) continue; const x = BX0 + 70 + (i % 8) * 54 + (Math.floor(i / 8)) * 20, y = 214 - Math.floor(i / 8) * 20 - (1 - f) * 90 * (1 - f);
        caos(x, y, 2.8, { col: PCOL[(i + 3) % 8], mood: 'happy' }); }
    }
    chicken(cx, cy, T, 1.15, cdir, fl);
    // glass over the cabin and the pillars on top of the passengers
    ctx.fillStyle = 'rgba(190,235,255,.22)'; rr(BX0 + 28, 250, BX1 - BX0 - 56, 50, 8); ctx.fill();
    for (let i = 0; i < 8; i++) { ctx.fillStyle = INK; ctx.fillRect(BX0 + 28 + i * 70 - 3, 248, 6, 54); }
    // name tags
    pill(BENCH[0].cx, 346, me === 1 ? 'YOU' : name(1), cols(1), 15);
    pill(BENCH[1].cx, 346, me === 2 ? 'YOU' : name(2), cols(2), 15);
    pill(BX0 - 26, FLOOR - 56, me === 0 ? 'YOU' : name(0), cols(0), 15);
    if (n === 4) pill(BX1 - 16, 276, me === 3 ? 'YOU' : name(3), cols(3), 15);
  }

  /* ───── the HUD that lives in the world: a hanging scale, a chalkboard, the driver's road ───── */
  function hud(T, prog, tl, won, lost, rk) {
    // the weight scale, hung from the power line
    const gx = 400, gy = 148;
    line([[290, 52], [330, 94]], 3, '#3a3550'); line([[510, 52], [470, 94]], 3, '#3a3550');
    rr(316, 90, 168, 86, 12); ink('#fff6d6', 4);
    ctx.beginPath(); ctx.arc(gx, gy, 62, Math.PI, 0); ctx.lineTo(gx, gy); ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill();
    const a0 = Math.PI + (.5 - TIPPED / 2 * 1) * 0;                                  // zones: red beyond +-.6 (maps to +-.6 * 70 deg)
    const ang = k => -Math.PI / 2 + k * 70 * Math.PI / 180;
    for (const [lo, hi, c] of [[-1, -TIPPED, '#e8343d'], [-TIPPED, TIPPED, '#4cd964'], [TIPPED, 1, '#e8343d']]) { ctx.beginPath(); ctx.moveTo(gx, gy); ctx.arc(gx, gy, 56, ang(lo), ang(hi)); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); }
    ctx.beginPath(); ctx.arc(gx, gy, 62, Math.PI, 0); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
    const nv = clamp(tl, -1.15, 1.15) + Math.sin(T * 30) * .015 * Math.abs(tl), na = ang(nv);
    line([[gx, gy], [gx + Math.cos(na) * 50, gy + Math.sin(na) * 50]], 4, '#2a2638'); ctx.beginPath(); ctx.arc(gx, gy, 7, 0, TAU); ink('#ffd23f', 2.5);
    if (!g.result && over > .05) { rr(330, 160, 140, 10, 5); ink('#3a3550', 2); ctx.fillStyle = '#ff3d3d'; rr(330, 160, 140 * clamp(over, 0, 1), 10, 5); ctx.fill(); }
    // chalkboard: aboard count
    rr(40, 78, 130, 64, 8); ink('#27564a', 4); ctx.strokeStyle = '#c99a5b'; ctx.lineWidth = 5; rr(40, 78, 130, 64, 8); ctx.stroke();
    txt('ABOARD', 105, 96, 15, '#fff', 'center', 110); txt(`${aboard.length} / ${NEED}`, 105, 124, 30, aboard.length >= NEED ? '#9bff9b' : '#ffe14d', 'center', 110);
    // role inputs
    if (!g.result) {
      if (me === 0) {
        const k = Math.sin(T * 8) * .5 + .5; pill(BX0 - 26, FLOOR + 38, TOUCH ? 'TAP!' : 'SPACE!', '#ffe14d', 17);
        if (cool <= 0 && pull < QLEN) { ctx.save(); ctx.globalAlpha = .9; demoFinger(BX0 - 26 + 40, FLOOR + 52 + k * 4, k > .5, 0); ctx.restore(); }
      } else {
        const big = TOUCH, ky = big ? 506 : 520; keycap(big ? 52 : 74, ky, -1, u < -.3, big); keycap(big ? 748 : 726, ky, 1, u > .3, big);
        if (me < 3) {
          const hot = Math.abs(tl) > .25, dir = hot ? -Math.sign(tl) : Math.abs(p) > .45 ? -Math.sign(p) : 0;
          if (dir) arrowCue(BENCH[me - 1].cx + dir * 138, 430, dir, clamp((Math.abs(tl) - .25) / .35, 0, 1), T);
        } else {
          // the road ahead: a mirror panel only the driver gets
          const rx = 296, ry = 462, rw = 208, rh = 118; rr(rx - 4, ry - 4, rw + 8, rh + 8, 10); ink('#2a2638', 3);
          ctx.save(); rr(rx, ry, rw, rh, 8); ctx.clip(); ctx.fillStyle = '#4a4660'; ctx.fillRect(rx, ry, rw, rh);
          ctx.fillStyle = '#ffd23f'; for (let k = 0; k < 4; k++) ctx.fillRect(rx + rw / 2 - 3, ry + ((k * 40 + sx * .6) % 160) - 20, 6, 22);
          for (const e of PH) { const ah = e.s0 - S; if (ah < -.3 || ah > 2.4) continue; const y = ry + rh - 14 - (2.4 - ah) / 2.4 * (rh - 24) , x = rx + 14 + e.x * (rw - 28); el(x, y, 17, 9); ink('#1b1830', 3); glint(x - 4, y - 3, 5, 2, .25); }
          const bx = rx + 14 + lane * (rw - 28); rr(bx - 11, ry + rh - 22, 22, 18, 5); ink(BUS, 3);
          ctx.restore();
          let nx = null; for (const e of PH) { const ah = e.s0 - S; if (ah > -.1 && ah < 1.6) { nx = e; break; } }
          if (nx && Math.abs(lane - nx.x) < .22) { const dir = lane >= nx.x ? 1 : -1; arrowCue(clamp(rx + 14 + lane * (rw - 28) + dir * 70, 60, 740), 430, dir, .6, T); }
          if (T - dodgeAt < .7) badge('DODGED!', 400, 424, 18, '#22a447', '#fff', outBack((T - dodgeAt) / .15));
        }
      }
    }
    if (n === 4 && me !== 3 && T - bumpAt < .6 && !g.result) badge('BUMP!', 400, 232, 22, '#e8343d', '#fff', outBack((T - bumpAt) / .15), -.05);
    if (won && rk > .2) for (let i = 0; i < 14; i++) { const d = rk - .1 - hash(i + 3) * .7; if (d < 0) continue; const fx2 = 90 + hash(i) * 620 + Math.sin(d * 4 + i) * 16, fy = -20 + d * (200 + hash(i + 9) * 60); if (fy < 560) { ctx.save(); ctx.translate(fx2, fy); ctx.rotate(d * 3 + i); rr(-6, -4, 12, 8, 2); ink(['#ff4d6d', '#ffe14d', '#4db8ff', '#7CE08A'][i % 4], 1.5); ctx.restore(); } }
  }

  g.dbg = { view: () => ({ p, tilt: tiltNow(), aboard: aboard.length, queue: QLEN - pull, S, n, me, lane, hits, over, ready: cool <= 0 && pull < QLEN, loads: [load(0), load(1)], next: PH.find(e => !e.done && e.s0 - S > -.3) || null, loadMe: me > 0 && me < 3 ? load(me - 1) : 0, tOther: me === 1 ? pOf(1) : pOf(0) }), PH, Q };
  wire(g, D, 0, sp, 'sq_apretujen');
  return g;
}

/* ───────────── intro card (520x240 frame), a 4 s loop per role ───────────── */
function demo(role, n, t) {
  const u = t % 4;
  ctx.fillStyle = '#9fdcff'; ctx.fillRect(0, 0, 520, 150); ctx.fillStyle = '#4f9a74'; ctx.beginPath(); ctx.moveTo(0, 110); ctx.lineTo(130, 50); ctx.lineTo(260, 90); ctx.lineTo(380, 40); ctx.lineTo(520, 100); ctx.lineTo(520, 150); ctx.lineTo(0, 150); ctx.fill();
  ctx.fillStyle = ASPH; ctx.fillRect(0, 150, 520, 90); ctx.fillStyle = '#ffd23f'; for (let x = -((t * 120) % 100); x < 520; x += 100) ctx.fillRect(x, 215, 50, 6);
  const kick = u > 1 && u < 2 ? Math.exp(-(u - 1) / .4) : 0, corr = u > 1.3 ? clamp((u - 1.3) / .8, 0, 1) : 0, tl = role === 3 ? Math.sin(t * 3) * .05 : (.5 * kick * (1 - corr) + .04 * Math.sin(t * 2));
  ctx.save(); ctx.translate(260, 190); ctx.rotate(tl * .3); ctx.translate(-260, -190);
  ctx.save(); ctx.translate(260, 190); ctx.scale(.62, .62); ctx.translate(-446, -GY + 6); ctx.translate(0, -2);
  for (const wx of [REAR, FRONT]) { ctx.beginPath(); ctx.arc(wx, GY - 31, 31, 0, TAU); ink('#2a2638', 4); }
  rr(BX0, 226, BX1 - BX0, 176, 24); ink(BUS, 5); ctx.fillStyle = GRN; ctx.fillRect(BX0 + 4, 360, BX1 - BX0 - 8, 24);
  rr(BX0 + 14, 242, BX1 - BX0 - 8, 148, 12); ink(CREAM, 4);
  const cnt = role === 0 ? 3 + Math.floor(u * 2) % 4 : 5;
  for (let k = 0; k < cnt; k++) caos(BX0 + 70 + k * 52 + (k > 2 ? 80 : 0) + (role === 1 || role === 2 ? tl * 90 : 0), FLOOR - 4, 3, { col: PCOL[k % 8], mood: tl > .3 ? 'sad' : null });
  caos(BX0 - 26, FLOOR + 4, 3.1, { col: COLS[0] }); caos(BX1 - 18, FLOOR - 2, 3.1, { col: COLS[3] });
  if (role === 0 && u > .4) { const f = clamp((u - .4) / .4, 0, 1) % 1; caos(lerp(BX0 - 150, BX0 - 20, ease(f)), FLOOR + 6 - Math.sin(f * Math.PI) * 40, 3, { col: PCOL[(Math.floor(u * 2)) % 8] }); }
  ctx.restore(); ctx.restore();
  // gauge
  const gx = 90, gy = 70; rr(gx - 60, gy - 50, 120, 70, 10); ink('#fff6d6', 3);
  const nv = tl * 1.6; line([[gx, gy + 6], [gx + Math.sin(nv) * 42, gy + 6 - Math.cos(nv) * 42]], 3, '#2a2638');
  const press = role >= 1 ? (Math.abs(tl) > .1 ? -Math.sign(tl) : 0) : 0;
  if (role === 0) { badge('PULL THEM IN!', 330, 28, 18, '#22a447', '#fff', 1, -.03); pill(250, 120, TOUCH ? 'TAP!' : 'SPACE!', '#ffe14d', 16); demoFinger(300, 176 + (u % 1 < .3 ? 4 : 0), u % 1 < .3, (u % 1) / .3); }
  else if (role === 3) {
    badge('DODGE THE HOLES!', 330, 28, 18, '#2b9ee6', '#fff', 1, -.03);
    const ly = 150 + ((t * 70) % 90); el(180 + Math.sin(t * 1.5) * 20, ly, 24, 11); ink('#1b1830', 3); keycap(380, 196, -1, Math.cos(t * 1.5) < 0); keycap(450, 196, 1, Math.cos(t * 1.5) > 0);
  } else { badge('BALANCE THE BUS!', 330, 28, 18, '#2b9ee6', '#fff', 1, -.03); keycap(380, 196, -1, press < 0); keycap(450, 196, 1, press > 0); demoFinger(press < 0 ? 380 : press > 0 ? 450 : 415, 216, !!press, 0); }
}
reg('sq_apretujen', sqApretujen, 'APRETUJEN'); REGMAP.sq_apretujen.duo = true; REGMAP.sq_apretujen.squad = true;
DUO.INFO.sq_apretujen = n => [
  ['COLLECTOR', 'PULL PEOPLE ABOARD', 'TAP / CLICK / SPACE'],
  ['REAR BENCH', 'SHUFFLE THE WEIGHT', 'HOLD ◄ ► OR DRAG SIDEWAYS'],
  ['FRONT BENCH', 'SHUFFLE THE WEIGHT', 'HOLD ◄ ► OR DRAG SIDEWAYS'],
  ['DRIVER', 'DODGE THE POTHOLES', 'HOLD ◄ ► OR DRAG SIDEWAYS'],
].slice(0, n);
DUO.DEMOS.sq_apretujen = n => Array.from({ length: n }, (_, r) => t => demo(r, n, t));

})();
