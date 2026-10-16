'use strict';
/* ═════════ DUO · COBRA EL PASAJE (du_cobra): a packed por puesto crawling through Caracas ═════════
   COLECTOR (role 0, JUDGE): inside the van. Passengers hold up bills now and then: tap each hand to collect the fare (keys Q W E / A S D match
   the seats). When a passenger shouts "¡ME BAJO!" hit the big PARADA button (space) - that rings the bell lamp on the driver's dash.
   Ringing when nobody asked jams the button for a second, so mashing it does not work.
   CHOFER (role 1): sees only the road. HOLD (pointer anywhere / space / ↑) to go, RELEASE to brake, drag (or ◄ ►) to change lane around the
   potholes. Bus-stop signs come up; some are fake. Only the bell lamp tells the driver that the next sign is real. Stop within the zone of a
   real sign with the bell lit = a passenger gets off. Stopping at a fake one wastes time (people board); sailing past a real one = the
   passenger complains and costs a life (3). A pothole bump halves the speed and spills one collected fare.
   WIN: 4 real stops + 6 fares collected. LOSE: 3 missed stops or time. Gag: the colector flies out of the sliding door clutching coins /
   the roof rack overflows with cash and Caos honks.
   Netcode: the CHOFER owns the bus and publishes 's' [P, v, lane*100] (coalesced, latest), plus absolute counters 'sd' (mask of stops made),
   'ms' (mask of stops missed), 'ws' (wasted stops), 'bp' (bumps). The COLECTOR owns the fares and the bell: 'bell' i (absolute, idempotent).
   The level (stops, potholes, fares) is drawn from mkR() in the constructor, the same on both screens. */
(function () {
const { clamp, mkR, wire } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const hsh = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // cosmetic randomness only

/* ───────────── tuning ───────────── */
const NS = 8, S0 = 360, SG = 380, ZN = 60;            // stops: how many, first sign, spacing, half length of the stop zone
const NEED = 4, NEEDF = 6, NF = 8, HOLD = 2.9;       // real stops to make, fares to collect (of NF), seconds a hand stays up
const VMAX = 290, ACC = 520, BRK = 1100, LSPD = 7;   // bus speed px/s, accel, brake, lane change (lanes/s)
const LW = 170, HZ = 192, YB = 525;                  // road view: lane width at the near plane, horizon y, near plane y
const BTN = { x: 600, y: 492, r: 54 };               // the PARADA button
const PX = i => 110 + (i % 3) * 185, PY = i => i < 3 ? 330 : 472;   // passenger seats (feet)
const BAG = { x: 668, y: 534 };
const BILL = { 1: '#ffe14d', 2: '#8be08b', 5: '#ff9aa8', 10: '#8fd0ff' };
const PAL = ['#ff7a59', '#4db8ff', '#b49cff', '#5CFF7A', '#ff6fa8', '#ffcf33'];

let X = ctx;
const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
function rr(x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function pill(x, y, label, col) {
  X.font = '700 17px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = t(label), w = Math.min(170, X.measureText(s).width + 26);
  X.beginPath(); X.moveTo(x - 9, y + 13); X.lineTo(x, y + 24); X.lineTo(x + 9, y + 13); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 14, w, 28, 14); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 11, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 17, INK, 'center', w - 14);
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
function arm(u, sx, an, k, col) {
  if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
  X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
  X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4);
  X.restore();
}
function heart(x, y, s, col, cracked) {
  X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-16, -2, -10, -14, 0, -6); X.bezierCurveTo(10, -14, 16, -2, 0, 8); X.closePath(); ink(col, 2.5);
  if (cracked) line([[0, -6], [-3, -1], [2, 2], [-1, 7]], 2.4, INK); else { X.fillStyle = 'rgba(255,255,255,.55)'; el(-5, -5, 2.6, 1.7, -.5); X.fill(); }
  X.restore();
}
function coin(x, y, r, T) {
  X.save(); X.translate(x, y); const sq = Math.abs(Math.cos(T * 6 + x)) * .6 + .4; el(0, 0, r * sq, r); ink('#ffd23f', Math.max(1.5, r * .22));
  X.fillStyle = 'rgba(255,255,255,.6)'; el(-r * .2 * sq, -r * .3, r * .22 * sq, r * .3, -.4); X.fill(); X.restore();
}
function bill(x, y, val, rot, sc) {
  X.save(); X.translate(x, y); X.rotate(rot); X.scale(sc, sc); rr(-21, -13, 42, 26, 5); ink(BILL[val] || '#ffe14d', 3);
  X.strokeStyle = 'rgba(20,16,28,.45)'; X.lineWidth = 2; rr(-16, -8, 32, 16, 3); X.stroke();
  txt(String(val), 0, 1, 17, INK, 'center', 28); X.restore();
}

/* the six passengers: colour, seat colour, hat */
const LOOK = [
  { col: '#ff9ec7', seat: '#3a63b8', hat: 'bun' }, { col: '#4db8ff', seat: '#b8433a', hat: 'cap' }, { col: '#b49cff', seat: '#3a63b8', hat: 'straw' },
  { col: '#5CFF7A', seat: '#b8433a', hat: 'band' }, { col: '#ffcf33', seat: '#3a63b8', hat: 'beret' }, { col: '#ff7a59', seat: '#b8433a', hat: 'bow' },
];
function hatDraw(h, u, T) {
  const y = -12.6 * u;
  if (h === 'bun') { X.beginPath(); X.arc(0, y - 1.2 * u, 2.1 * u, 0, TAU); ink('#fff', 3); X.fillStyle = '#bbb'; el(-.5 * u, y - 1.2 * u, .8 * u, .5 * u); X.fill(); }
  else if (h === 'cap') { rr(-5 * u, y - 1.6 * u, 10 * u, 2.6 * u, 3); ink('#e0453d', 3); rr(1 * u, y + .2 * u, 7 * u, 1.1 * u, 2); ink('#a32a24', 2.5); }
  else if (h === 'straw') { el(0, y + .6 * u, 8 * u, 1.6 * u); ink('#f1d17a', 3); rr(-3.6 * u, y - 2.4 * u, 7.2 * u, 3 * u, 4); ink('#f1d17a', 3); X.fillStyle = '#e0453d'; X.fillRect(-3.6 * u, y - .4 * u, 7.2 * u, .8 * u); }
  else if (h === 'band') { rr(-6 * u, y + .1 * u, 12 * u, 1.3 * u, 3); ink('#ff4d6d', 3); }
  else if (h === 'beret') { el(1 * u, y - .4 * u, 6 * u, 2 * u, -.15); ink('#7a4ab8', 3); X.fillStyle = INK; X.fillRect(.6 * u, y - 3 * u, .8 * u, 1 * u); }
  else { X.beginPath(); X.moveTo(0, y); X.lineTo(-4.4 * u, y - 2.4 * u); X.lineTo(-4.4 * u, y + 1.6 * u); X.closePath(); ink('#ff4d9e', 2.5); X.beginPath(); X.moveTo(0, y); X.lineTo(4.4 * u, y - 2.4 * u); X.lineTo(4.4 * u, y + 1.6 * u); X.closePath(); ink('#ff4d9e', 2.5); }
}
/* one passenger at feet (x, y): hand = bill value (0 = none), lean = body tilt, gone = 0..1 hop out, alt = the next passenger to sit here */
function passenger(x, y, i, T, o) {
  const L = LOOK[(i + (o.alt || 0)) % 6], u = 3.3;
  X.save(); X.translate(x, y);
  rr(-46, -66, 92, 78, 14); ink(L.seat, 4); X.fillStyle = 'rgba(255,255,255,.2)'; rr(-40, -60, 22, 62, 8); X.fill();
  X.restore();
  if (o.gone >= 1) return;
  X.save(); X.translate(x + (o.gone || 0) * 200, y - Math.sin((o.gone || 0) * Math.PI) * 60); X.rotate((o.lean || 0) + (o.gone || 0) * .5);
  const raised = o.hand > 0, w = Math.sin(T * 10 + i) * .15;
  arm(u, -1, -2.8, .7, L.col); arm(u, 1, raised ? .32 + w : 2.8, raised ? 1 : .7, L.col);
  caos(0, 0, u, { col: L.col, mood: o.mood });
  hatDraw(L.hat, u, T);
  if (raised) { const ax = 6.6 * u + Math.sin(.32 + w) * 5.65 * u, ay = -5.2 * u - Math.cos(.32 + w) * 5.65 * u; bill(ax, ay - 16, o.hand, .2 + w, 1); }
  X.restore();
}

/* ───────────── scenery shared by both screens: Caracas ───────────── */
function mountain(off, y0, col, shade, par, hh) {      // Ávila: big green humps, parallax
  const per = 760, o = (off * par) % per;
  for (let k = -1; k < 3; k++) {
    const bx = k * per - o;
    X.beginPath(); X.moveTo(bx - 60, y0); X.bezierCurveTo(bx + 120, y0 - hh * 1.1, bx + 220, y0 - hh * 1.25, bx + 330, y0 - hh * .75); X.bezierCurveTo(bx + 470, y0 - hh * 1.15, bx + 600, y0 - hh * .6, bx + 700, y0); X.closePath(); ink(col, 3);
    X.fillStyle = shade; X.beginPath(); X.moveTo(bx + 330, y0 - hh * .75); X.bezierCurveTo(bx + 470, y0 - hh * 1.15, bx + 600, y0 - hh * .6, bx + 700, y0); X.lineTo(bx + 420, y0); X.closePath(); X.fill();
  }
}
function towers(x, yb, s, T) {                         // Parque Central: the twin towers
  for (const dx of [-26, 26]) { rr(x + dx * s - 20 * s, yb - 150 * s, 40 * s, 150 * s, 3 * s); ink('#9fb3d4', Math.max(1.5, 3 * s)); X.fillStyle = 'rgba(255,255,255,.35)'; for (let r = 0; r < 7; r++) X.fillRect(x + dx * s - 14 * s, yb - 140 * s + r * 20 * s, 28 * s, 6 * s); }
  rr(x - 16 * s, yb - 70 * s, 32 * s, 70 * s, 3 * s); ink('#cbd6ea', Math.max(1.5, 3 * s));
}
function rancho(x, yb, w, h, col, s) {
  const lw = Math.max(1.5, 3.4 * s);
  rr(x - w / 2, yb - h, w, h, 3 * s); ink(col, lw);
  X.fillStyle = 'rgba(20,16,28,.18)'; X.fillRect(x + w * .1, yb - h, w * .4, h);
  X.fillStyle = '#8a8fa3'; X.fillRect(x - w / 2 - 3 * s, yb - h - 5 * s, w + 6 * s, 7 * s);
  rr(x - w * .34, yb - h * .62, w * .24, h * .26, 2 * s); ink('#ffe58a', Math.max(1, 2.4 * s));
  rr(x + w * .1, yb - h * .5, w * .22, h * .5, 2 * s); ink('#7a4a2c', Math.max(1, 2.4 * s));
}
function palm(x, yb, h, s, T, ph) {
  const lw = Math.max(1.5, 3 * s);
  line([[x, yb], [x + 5 * s, yb - h * .5], [x + 2 * s, yb - h]], Math.max(2, 9 * s), '#8a5a2c');
  const sw = Math.sin(T * 2 + ph) * 3 * s;
  for (let k = 0; k < 5; k++) { const a = -2.7 + k * .55; X.save(); X.translate(x + 2 * s, yb - h); X.rotate(a + sw * .01); el(24 * s, 0, 26 * s, 6 * s); ink('#3fae52', lw); X.restore(); }
}

/* ═════════ the game ═════════ */
function duCobra(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), colector = D.role === 0, TS = Math.sqrt(sp);
  const VM = VMAX * TS, AC = ACC * TS * TS, BR = BRK * TS * TS, LS = LSPD * TS;
  /* ----- the level (identical draws on both screens) ----- */
  const sh = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fk = sh([0, 1, 2, 3, 4, 5, 6, 7]), fake = new Set([fk[0], fk[1]]), pxs = sh([0, 1, 2, 3, 4, 5]), stops = []; let rc = 0;
  for (let i = 0; i < NS; i++) { const real = !fake.has(i); stops.push({ i, p: S0 + i * SG, real, pax: real ? pxs[rc++ % 6] : -1, st: 0, wt: 0, wasted: false }); }
  const holes = [];
  for (let p = 210; p < S0 + NS * SG + 200; p += 125 + R() * 95) {
    const l1 = Math.floor(R() * 3); holes.push({ p, l: l1, hit: false });
    if (R() < .4) holes.push({ p: p + (R() - .5) * 20, l: (l1 + 1 + Math.floor(R() * 2)) % 3, hit: false });
  }
  const fp = sh([0, 1, 2, 3, 4, 5]), fares = [];
  for (let k = 0; k < NF; k++) fares.push({ pax: fp[k % 6], t0: (.5 + k * .95 + R() * .4) / TS, val: [1, 2, 5, 10][Math.floor(R() * 4)], got: false, at: -9, lost: false });
  const HLD = HOLD / TS;
  /* ----- state ----- */
  const kGo = new Set(), pops = [], flies = [], bits = [];
  let held = false, laneT = 1, lx = 1, P = 0, v = 0, frozen = 0, mask = 0, miss = 0, wasteN = 0, bumps = 0, sSent = -9, lastS = '', lamp = false, hitAt = -9, goT = 0;   // chofer
  const bell = stops.map(() => false);
  let pView = 0, vView = 0, lxView = 1, recvP = 0, recvV = 0, recvT = -1, maskV = 0, missV = 0, wasteV = 0, bumpV = 0, vSm = 0;   // colector
  let collected = 0, jam = 0, btnAt = -9, falseAt = -9;
  const byeAt = [-9, -9, -9, -9, -9, -9], alt = [0, 0, 0, 0, 0, 0], seenBye = new Set();
  let resAt = -1;
  const pc = m => { let n = 0; for (; m; m &= m - 1) n++; return n; };
  const lives = () => 3 - pc(colector ? missV : miss), stopsDone = () => pc(colector ? maskV : mask), fcNet = () => Math.max(0, collected - bumpV);
  function pop(s, x, y, size, bgc, fg) { pops.push({ s, x, y, size, bgc, fg, t0: g.c, rot: (hsh(g.c * 7) - .5) * .16 }); if (pops.length > 3) pops.shift(); }
  function spill(x, y, n, c) { for (let i = 0; i < n; i++) bits.push({ x, y, vx: (hsh(i + g.c * 3) - .5) * 340, vy: -120 - hsh(i * 3 + g.c) * 260, t0: g.c, life: .9, c: c || '#ffd23f' }); }
  function bellSnd() { snd(1318, .14, 'sine', .08); snd(1760, .22, 'sine', .06, .1); }
  function nextStop() { for (const s of stops) if (!s.st && s.p - P > -ZN) return s; return null; }
  const activeStop = () => stops.find(s => s.real && !(maskV >> s.i & 1) && !(missV >> s.i & 1) && pView >= s.p - 330 && pView <= s.p + 110) || null;
  const handsUp = T => fares.filter(f => !f.got && !f.lost && T >= f.t0 && T < f.t0 + HLD);

  function ring(i) {
    if (jam > 0 || g.result) return;
    const a = activeStop();
    if (a) { if (!bell[a.i]) { bell[a.i] = true; D.send('bell', a.i); bellSnd(); btnAt = g.c; } }
    else { jam = 1.2; falseAt = g.c; sfx.miss(); pop('NOBODY ASKED!', BTN.x - 30, BTN.y - 90, 24, '#e8434f', '#fff'); }
  }
  function collect(pax) {
    const f = handsUp(g.c).find(q => q.pax === pax); if (!f || g.result) return;
    f.got = true; f.at = g.c; collected++; sfx.coin(); flies.push({ x: PX(pax) + 22, y: PY(pax) - 75, t0: g.c, v: f.val });
    pop('PAID!', PX(pax), PY(pax) - 110, 22, '#2fa84a', '#fff');
  }

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: colector ? 'COLLECT!' : 'DRIVE!', roleLabel: colector ? 'COLLECTOR' : 'DRIVER',
    hint: colector ? 'TAP EACH HAND TO COLLECT THE FARE (Q W E / A S D). WHEN A PASSENGER SHOUTS "GETTING OFF!" HIT BUS STOP (SPACE) SO YOUR FRIEND KNOWS TO BRAKE' : 'HOLD (MOUSE OR SPACE) TO GO, RELEASE TO BRAKE, ◄ ► TO DODGE POTHOLES. ONLY STOP AT A SIGN WHEN THE BELL LAMP LIGHTS - SOME STOPS ARE FAKE',
    thint: colector ? 'TAP EACH HAND TO COLLECT THE FARE. WHEN A PASSENGER ASKS TO GET OFF, TAP BUS STOP! SO YOUR FRIEND KNOWS TO BRAKE' : 'HOLD TO GO, DRAG LEFT / RIGHT TO DODGE POTHOLES, LET GO TO BRAKE. ONLY STOP AT A SIGN WHEN THE BELL LAMP LIGHTS',
    update(dt) {
      g.c += dt;
      if (g.result && resAt < 0) resAt = g.c;
      if (jam > 0) jam = Math.max(0, jam - dt);
      for (const f of fares) if (!f.got && !f.lost && g.c >= f.t0 + HLD) f.lost = true;
      for (let i = flies.length - 1; i >= 0; i--) if (g.c - flies[i].t0 > .5) flies.splice(i, 1);
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += 900 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (g.c - b.t0 > b.life) bits.splice(i, 1); }
      if (pops.length && g.c - pops[0].t0 > 1.1) pops.shift();
      if (colector) {
        if (recvT < 0) pView = 0; else { const pe = recvP + recvV * Math.min(.4, g.c - recvT); pView += (Math.max(pView, pe) - pView) * Math.min(1, dt * 10); }
        vView += (recvV - vView) * Math.min(1, dt * 12); vSm += (vView - vSm) * Math.min(1, dt * 3);
        lxView += (lxRecv - lxView) * Math.min(1, dt * 14);
        for (let i = 0; i < NS; i++) if ((maskV >> i & 1) && !seenBye.has(i)) { seenBye.add(i); const px = stops[i].pax; if (px >= 0) byeAt[px] = g.c; }
        for (let px = 0; px < 6; px++) if (byeAt[px] > 0 && g.c - byeAt[px] > 1.2) { alt[px]++; byeAt[px] = -1; }
        if (!g.result) {
          if (lives() <= 0) g.finish('lose');
          else if (stopsDone() >= NEED && fcNet() >= NEEDF) g.finish('win');
          else if (g.c >= g.limit) g.finish('lose');
        }
      } else {
        const done = !!g.result;
        const go = (held || kGo.size > 0) && !done;
        if (frozen > 0) { frozen -= dt; v = 0; } else if (go) v = Math.min(VM, v + AC * dt); else v = Math.max(0, v - BR * dt);
        goT += ((go ? 1 : 0) - goT) * Math.min(1, dt * 14);
        P += v * dt;
        lx += clamp(laneT - lx, -LS * dt, LS * dt);
        for (const h of holes) if (!h.hit && Math.abs(h.p - P) < 22 && Math.abs(h.l - lx) < .55) {
          h.hit = true; bumps++; v *= .3; hitAt = g.c; sfx.thud(); shake(8, .25); noise(.2, .08, 700, 180, 'lowpass'); D.send('bp', bumps); pop('POTHOLE!', 400, 300, 30, '#e8434f', '#fff'); spill(400, 470, 6);
        }
        for (const s of stops) if (!s.st) {
          const dd = s.p - P;
          if (Math.abs(dd) < ZN && v < 24 && frozen <= 0) {
            if (bell[s.i]) { s.st = 1; mask |= 1 << s.i; frozen = .5 / TS; v = 0; D.send('sd', mask); sfx.coin(); pop('OFF THEY GO!', 400, 300, 28, '#2fa84a', '#fff'); }
            else if (!s.wasted) { s.wt += dt; if (s.wt > .7 / TS) { s.wasted = true; frozen = .9 / TS; wasteN++; D.send('ws', wasteN); sfx.buzz(); pop('NOBODY GETS OFF!', 400, 300, 26, '#e8434f', '#fff'); } }
          } else if (dd < -ZN) {
            s.st = 2;
            if (s.real) { miss |= 1 << s.i; D.send('ms', miss); sfx.miss(); shake(6, .2); pop('YOU MISSED MY STOP!', 400, 300, 24, '#e8434f', '#fff'); }
          }
        }
        lamp = false; const ns = nextStop(); if (ns && bell[ns.i]) lamp = true;
        const sm = Math.round(P) + ',' + Math.round(v) + ',' + Math.round(lx * 100);
        if (sm !== lastS && g.c - sSent >= .08) { lastS = sm; sSent = g.c; D.send('s', [Math.round(P), Math.round(v), Math.round(lx * 100)], true); }
      }
    },
    msg(type, d) {
      if (colector) {
        if (type === 's' && Array.isArray(d)) { if (d[0] >= recvP) { recvP = d[0]; recvV = d[1]; lxRecv = d[2] / 100; recvT = g.c; } }
        else if (type === 'sd' && typeof d === 'number') { if (d !== maskV) { const nw = d & ~maskV; maskV |= d; sfx.coin(); const i = Math.log2(nw & -nw); pop('OFF THEY GO!', PX(stops[i] ? Math.max(0, stops[i].pax) : 0), 230, 26, '#2fa84a', '#fff'); } }
        else if (type === 'ms' && typeof d === 'number') { if (d !== missV) { missV |= d; sfx.miss(); shake(7, .22); pop('YOU MISSED MY STOP!', 300, 250, 24, '#e8434f', '#fff'); } }
        else if (type === 'ws' && typeof d === 'number') { if (d > wasteV) { wasteV = d; pop('NOBODY GETS OFF!', 300, 250, 24, '#e8a838', '#fff'); } }
        else if (type === 'bp' && typeof d === 'number') { if (d > bumpV) { bumpV = d; shake(7, .22); sfx.thud(); spill(BAG.x, BAG.y - 40, 5); pop('POTHOLE!', 400, 250, 26, '#e8434f', '#fff'); } }
      } else if (type === 'bell' && typeof d === 'number' && stops[d]) { if (!bell[d]) { bell[d] = true; bellSnd(); } }
    },
    draw() {
      X = ctx; const T = g.c, won = g.result === 'win', lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      if (colector) drawColector(T, won, lost, rk); else drawDriver(T, won, lost, rk);
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .85 ? Math.max(0, 1 - (a - .85) / .25) : 1; badge(q.s, clamp(q.x, 150, 650), Math.max(120, q.y - Math.min(a, .6) * 18), q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
      if (!g.result && T < 3.4) badge(colector ? 'TAP HANDS, RING THE BELL!' : 'STOP ONLY WHEN THE BELL RINGS!', 400, 232, 19, colector ? '#c98a12' : '#2b9ee6', '#fff', outBack(T / .3), -.03);
      vignette(.2);
    },
    down(p) {
      held = true;
      if (!colector) { setLane(p.x); return; }
      if (Math.hypot(p.x - BTN.x, p.y - BTN.y) < BTN.r + 14) { ring(); return; }
      let best = -1, bd = 1e9; for (let i = 0; i < 6; i++) { const dx = p.x - PX(i), dy = p.y - (PY(i) - 50); if (Math.abs(dx) < 70 && dy > -90 && dy < 50 && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = i; } }
      if (best >= 0) collect(best);
    },
    up() { held = false; },
    move(p) { if (!colector && held) setLane(p.x); },
    key(e) {
      const c = e.code; if (c === 'KeyP' || c === 'KeyM' || c === 'Escape') return;
      if (colector) {
        const m = { KeyQ: 0, KeyW: 1, KeyE: 2, KeyA: 3, KeyS: 4, KeyD: 5, Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5 };
        if (c === 'Space' || c === 'Enter') ring(); else if (c in m) collect(m[c]);
      } else {
        if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW') kGo.add(c);
        else if (c === 'ArrowLeft' || c === 'KeyA') laneT = Math.max(0, Math.round(laneT) - 1);
        else if (c === 'ArrowRight' || c === 'KeyD') laneT = Math.min(2, Math.round(laneT) + 1);
      }
    },
    keyup(e) { kGo.delete(e.code); },
  };
  let lxRecv = 1;
  function setLane(x) { laneT = x < 267 ? 0 : x < 533 ? 1 : 2; }

  /* ═════ the colector's screen: inside the van ═════ */
  function drawColector(T, won, lost, rk) {
    const vv = vView / VM, bob = Math.sin(T * 19) * vv * 1.6, lean = clamp((vSm - vView) * .0007, -.1, .1) + Math.sin(T * 13) * vv * .01;
    // the roof rack and ceiling
    X.fillStyle = '#4a3d63'; X.fillRect(0, 0, W, 100); X.fillStyle = '#5b4d7a'; X.fillRect(0, 0, W, 54);
    X.fillStyle = 'rgba(255,255,255,.12)'; for (let x = 20; x < W; x += 120) X.fillRect(x, 8, 70, 6);
    // windows: scrolling Caracas
    X.save(); X.beginPath(); X.rect(0, 100, W, 108); X.clip();
    const sk = X.createLinearGradient(0, 100, 0, 208); sk.addColorStop(0, '#7fd3ff'); sk.addColorStop(1, '#ffe7a8'); X.fillStyle = sk; X.fillRect(0, 100, W, 108);
    el(660 - (pView * .02) % 900, 130, 26, 26); ink('#fff2a8', 3);
    mountain(pView, 206, '#3f9e5e', '#2d7a48', .1, 70);
    const per = 260, o = (pView * .45) % per;
    for (let k = -1; k < 5; k++) { const x = k * per - o + 40, kk = Math.floor((pView * .45) / per) + k;
      if (hsh(kk * 3 + 1) < .3) towers(x + 40, 210, .55, T); else rancho(x + 40, 212, 80 + hsh(kk) * 50, 60 + hsh(kk + 4) * 50, ['#ff9a8a', '#8fd0ff', '#ffe08a', '#a8e6a0'][kk & 3 & 3], .8); }
    const p2 = 190, o2 = (pView * 1.1) % p2;
    for (let k = -1; k < 6; k++) { const x = k * p2 - o2 + 20; line([[x, 210], [x, 134]], 6, '#555'); X.beginPath(); X.arc(x, 130, 9, 0, TAU); ink('#ffe58a', 2.5); }
    X.restore();
    X.fillStyle = INK; for (const x of [0, 262, 538, 796]) X.fillRect(x - 4, 96, 12, 116); X.fillRect(0, 96, W, 7); X.fillRect(0, 204, W, 8);
    // interior wall and floor, shaking a little with the road
    X.save(); X.translate(0, bob); X.fillStyle = '#e9d9b8'; X.fillRect(0, 212, W, 330); X.fillStyle = 'rgba(20,16,28,.1)'; for (let x = 0; x < W; x += 80) X.fillRect(x, 212, 4, 330);
    X.fillStyle = '#2f2a46'; X.fillRect(0, 524, W, 80); X.fillStyle = '#4b4570'; X.fillRect(0, 524, W, 10);
    X.restore();
    // roof gag: sign over the windows
    rr(300, 58, 200, 30, 8); ink('#ffcf33', 3); txt('PUESTO · CARACAS', 400, 74, 17, INK, 'center', 180);
    // the door (right): the panel slides open when the colector is thrown out
    const flyK = lost && rk >= 0 ? clamp(rk / .35, 0, 1) : 0;
    X.save(); rr(692, 216, 108, 316, 8); ink('#16122a', 4); X.clip();
    X.fillStyle = '#9fe0ff'; X.fillRect(692, 216, 108, 316); X.fillStyle = '#6a6a7a'; X.fillRect(692, 440, 108, 92);
    for (let i = 0; i < 4; i++) { const x = 800 - ((T * 900 * Math.max(.2, vv) + i * 60) % 108); X.fillStyle = 'rgba(255,255,255,.7)'; X.fillRect(x, 470 + i * 14, 40, 5); }
    X.fillStyle = '#d6453b'; rr(694 + ease(flyK) * 104, 218, 104, 312, 6); X.fill(); X.lineWidth = 6; X.strokeStyle = INK; X.stroke();
    X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(700 + ease(flyK) * 104, 226, 14, 296);
    X.restore();
    // passengers
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
      const i = r * 3 + c, hu = handsUp(T).find(f => f.pax === i), gone = byeAt[i] > 0 ? clamp((T - byeAt[i]) / .5, 0, 1) : 0;
      const sad = lost && rk > .1;
      passenger(PX(i), PY(i) + bob, i, T, { hand: hu ? hu.val : 0, lean, gone, alt: alt[i], mood: won ? 'happy' : sad ? 'sad' : (hu && T - hu.t0 > HLD * .7 ? 'sad' : null) });
      if (hu) { const k = (T - hu.t0) / HLD; X.fillStyle = k > .7 ? '#e8434f' : '#2fa84a'; rr(PX(i) - 22, PY(i) + 16, 44 * (1 - k), 6, 3); X.fill(); }
      // the "¡ME BAJO!" bubble
      const st = stops.find(s => s.real && s.pax === i && !(maskV >> s.i & 1) && !(missV >> s.i & 1) && pView >= s.p - 330 && pView <= s.p + 110);
      if (st && !g.result) { const bx = PX(i) + 6, by = PY(i) - 118 + Math.sin(T * 8) * 2 + bob, rung = bell[st.i];
        X.beginPath(); X.moveTo(bx - 8, by + 18); X.lineTo(bx - 14, by + 36); X.lineTo(bx + 6, by + 20); X.closePath(); ink('#fff', 3); rr(bx - 58, by - 18, 116, 38, 16); ink(rung ? '#b7f5c4' : '#fff', 3.5);
        txt(rung ? 'BELL RUNG!' : 'GETTING OFF!', bx, by + 2, 17, INK, 'center', 104); }
    }
    // door area: moneybag and the colector
    const wob = Math.sin(T * 6) * vv;
    el(BAG.x, BAG.y - 4, 34, 10); X.fillStyle = 'rgba(20,16,28,.3)'; X.fill();
    const bg = 1 + clamp(fcNet() / 8, 0, 1) * .5;
    X.save(); X.translate(BAG.x, BAG.y); X.scale(bg, bg); X.beginPath(); X.moveTo(-22, 0); X.bezierCurveTo(-34, -20, -22, -44, -8, -50); X.lineTo(8, -50); X.bezierCurveTo(22, -44, 34, -20, 22, 0); X.closePath(); ink('#c9a24b', 3.5);
    rr(-12, -58, 24, 10, 4); ink('#8a6a2c', 3); txt('Bs', 0, -22, 20, INK, 'center', 30); X.restore();
    for (let i = 0; i < Math.min(8, collected); i++) if (!lost) coin(BAG.x - 20 + (i % 4) * 13, BAG.y - 66 - Math.floor(i / 4) * 12, 7, T);
    const bump = T - hitAt;
    if (!(lost && rk >= .15)) {
      const wob2 = won && rk >= 0 ? Math.abs(Math.sin(T * 10)) * 12 : 0;
      X.save(); X.translate(750, 530 - wob2); if (won) { arm(4.2, -1, -.5 + Math.sin(T * 14) * .3, 1, myCol()); arm(4.2, 1, .5 - Math.sin(T * 14) * .3, 1, myCol()); } else { arm(4.2, -1, -2.5, .9, myCol()); arm(4.2, 1, -.4 + wob * .01, .9, myCol()); }
      caos(0, 0, 4.2, { col: myCol(), mood: won ? 'happy' : lost ? 'sad' : null });
      X.fillStyle = INK; rr(-26, -12.6 * 4.2 - 8, 52, 18, 6); X.fill(); rr(-23, -12.6 * 4.2 - 6, 46, 12, 5); X.fillStyle = '#fff'; X.fill(); X.fillStyle = '#e0453d'; X.fillRect(-23, -12.6 * 4.2 - 1, 46, 4);
      X.restore();
      if (T < 3.6 && !g.result) pill(750, 530 - 12.6 * 4.2 - 40, 'YOU', myCol());
    }
    // the PARADA button: a chunky red dome on a plate, bell icon, jammed = grey
    X.save(); const pressed = T - btnAt < .14, jm = jam > 0, bo = pressed ? 6 : 0;
    rr(BTN.x - 74, BTN.y - 66, 148, 134, 18); ink('#3a3550', 4); X.fillStyle = 'rgba(255,255,255,.12)'; rr(BTN.x - 66, BTN.y - 60, 132, 12, 6); X.fill();
    X.beginPath(); X.arc(BTN.x, BTN.y + 6, BTN.r, 0, TAU); ink(jm ? '#555' : '#9a1f2b', 4);
    X.beginPath(); X.arc(BTN.x, BTN.y - 4 + bo, BTN.r - 4, 0, TAU); ink(jm ? '#8a8a96' : '#ff3d4d', 4); X.fillStyle = 'rgba(255,255,255,.4)'; el(BTN.x - 18, BTN.y - 26 + bo, 20, 10, -.5); X.fill();
    txt('BUS STOP!', BTN.x, BTN.y + 6 + bo, 22, '#fff', 'center', 90);
    if (jm) { X.strokeStyle = '#fff'; X.lineWidth = 6; X.beginPath(); X.moveTo(BTN.x - 22, BTN.y - 32); X.lineTo(BTN.x + 22, BTN.y + 18); X.stroke(); }
    X.restore();
    // coin from hand to bag
    for (const f of flies) { const k = (T - f.t0) / .5, x = lerp(f.x, BAG.x, ease(k)), y = lerp(f.y, BAG.y - 50, ease(k)) - Math.sin(k * Math.PI) * 60; coin(x, y, 10, T); }
    for (const b of bits) { const a = T - b.t0; X.globalAlpha = clamp(1 - a / b.life, 0, 1); coin(b.x, b.y, 7, T); X.globalAlpha = 1; }
    hudBar();
    // win: the roof rack overflows with cash; Caos honks
    if (won && rk >= 0) {
      const k = clamp(rk / 1.2, 0, 1);
      for (let i = 0; i < 24; i++) { const x = 30 + i * 33, h = (14 + hsh(i) * 26) * ease(k); rr(x - 18, 56 - h, 36, h + 40, 8); ink(['#ffe14d', '#8be08b', '#ff9aa8', '#8fd0ff'][i & 3], 3); }
      for (let i = 0; i < 18; i++) { const q = (rk * .9 + i * .21) % 1, x = 30 + (i * 83) % 760 + Math.sin(rk * 3 + i) * 20, y = 60 + q * 470; bill(x, y, [1, 2, 5, 10][i & 3], rk * 2 + i, .75); }
      if (rk > .1) badge('BEEP BEEEEP!', 400, 340, 44, '#ffb23d', '#fff', outBack((rk - .1) / .22) * (rk > 2 ? Math.max(0, 1 - (rk - 2) * 2) : 1), -.06);
      if (rk > .5) badge('UEPA!', 400, 420, 34, '#2fa84a', '#fff', outBack((rk - .5) / .22), .05);
    }
    // lose: the colector shoots out of the sliding door, clutching coins
    if (lost && rk >= .15) {
      const q = rk - .15, x = 745 + q * 620, y = 500 - q * 330 + q * q * 520, a = q * 9;
      if (x < 900) { X.save(); X.translate(x, y); X.rotate(a); caos(0, 14, 4.2, { col: myCol(), mood: 'sad' }); X.restore(); for (let i = 0; i < 4; i++) coin(x - 30 - i * 26, y + 20 + Math.sin(rk * 20 + i) * 16 - i * 4, 9, T); }
      badge('AAAH, CHAMO!', 330, 330, 40, '#e8434f', '#fff', outBack(q / .2), -.05);
      if (q > .6) badge('THE COLLECTOR FLEW OUT!', 400, 420, 24, '#7e5bd6', '#fff', outBack((q - .6) / .25), .03);
    }
  }
  function hudBar() {
    const l = lives(), sd = stopsDone();
    for (let i = 0; i < 3; i++) heart(346 + i * 38, 82, 1.1, i >= l ? '#6b6486' : '#ff5c8a', i >= l);
    txt('STOPS', 560, 70, 15, '#fff', 'left', 70);
    for (let i = 0; i < NEED; i++) { X.beginPath(); X.arc(566 + i * 26, 92, 9, 0, TAU); ink(i < sd ? '#5CFF7A' : '#4a4558', 2.5); }
    if (colector) { txt('FARES', 200, 70, 15, '#fff', 'left', 70); for (let i = 0; i < NEEDF; i++) { X.beginPath(); X.arc(206 + i * 22, 92, 8, 0, TAU); ink(i < fcNet() ? '#ffd23f' : '#4a4558', 2.5); } }
  }

  /* ═════ the chofer's screen: the road ahead ═════ */
  const proj = d => 1 / (1 + d / 230), sy = s => HZ + (YB - HZ) * s, sxl = (lane, s) => 400 + (lane - lx) * LW * s;
  function drawDriver(T, won, lost, rk) {
    const bob = Math.sin(T * 22) * (v / VM) * 1.6;
    // sky, sun, the teleférico gag crossing the cable, Ávila
    const sk = X.createLinearGradient(0, 0, 0, HZ + 10); sk.addColorStop(0, '#5fbfff'); sk.addColorStop(1, '#ffe7a8'); X.fillStyle = sk; X.fillRect(0, 0, W, HZ + 12);
    el(170 - (P * .01) % 40, 110, 34, 34); ink('#fff2a8', 3.5);
    mountain(P, HZ + 6, '#3f9e5e', '#2d7a48', .08, 120);
    line([[-10, 110], [810, 70]], 3, '#444');
    const gx = ((T * 55) % 920) - 60, gy = 110 - (gx + 10) / 820 * 40;
    X.save(); X.translate(gx, gy + 22 + Math.sin(T * 3) * 2); line([[0, -22], [0, -8]], 3, '#444'); rr(-22, -8, 44, 32, 7); ink('#ff9a4d', 3); rr(-15, -2, 30, 16, 4); ink('#bfe9ff', 2); caos(0, 14, 1.1, { col: '#fff' }); X.restore();
    X.save(); X.translate(0, bob);
    X.fillStyle = '#7cc46a'; X.fillRect(0, HZ, W, H - HZ);
    // road
    const s0 = proj(3200), yf = sy(s0), edge = (u, s) => sxl(u, s);
    X.beginPath(); X.moveTo(edge(-.5, s0), yf); X.lineTo(edge(2.5, s0), yf); X.lineTo(edge(2.5, 1.2), sy(1.2)); X.lineTo(edge(-.5, 1.2), sy(1.2)); X.closePath(); ink('#5d5f78', 0);
    X.fillStyle = '#6a6c86'; X.fill();
    for (const [a, b] of [[-.5, -.72], [2.5, 2.72]]) { X.beginPath(); X.moveTo(edge(a, s0), yf); X.lineTo(edge(b, s0), yf); X.lineTo(edge(b, 1.2), sy(1.2)); X.lineTo(edge(a, 1.2), sy(1.2)); X.closePath(); X.fillStyle = '#d9d2c0'; X.fill(); }
    for (const u of [-.5, 2.5]) line([[edge(u, s0), yf], [edge(u, 1.2), sy(1.2)]], 5, INK);
    for (let k = 0; k < 30; k++) { const d = k * 80 - (P % 80), s1 = proj(Math.max(1, d)), s2 = proj(Math.max(1, d + 40)); if (d + 40 < 0) continue; for (const u of [.5, 1.5]) line([[edge(u, s1), sy(s1)], [edge(u, s2), sy(s2)]], Math.max(1.5, 7 * s1), '#fff'); }
    // roadside + signs + potholes + people, far to near
    const items = [];
    const i0 = Math.floor((P - 40) / 150);
    for (let i = i0 + 24; i >= i0; i--) for (const side of [-1, 1]) {
      const p = i * 150 + (side < 0 ? 40 : 0), d = p - P; if (d < -40) continue;
      const h = hsh(i * 2 + (side > 0 ? 1 : 0)), u = side < 0 ? -1.5 - h * 1.1 : 3.5 + h * 1.1;
      items.push({ d, k: h < .22 ? 'palm' : h < .35 ? 'towers' : 'house', u, h, i });
    }
    for (const s of stops) { const d = s.p - P; if (d > -60 && d < 3400) items.push({ d, k: 'sign', u: 3.05, s }); }
    for (const h of holes) { const d = h.p - P; if (d > -40 && d < 3400) items.push({ d, k: 'hole', u: h.l, hh: h }); }
    items.sort((a, b) => b.d - a.d);
    for (const it of items) {
      const dd = Math.max(1, it.d), s = proj(dd); if (s < .05 || it.d < -30) continue; const x = sxl(it.u, s), y = sy(s);
      if (it.k === 'house') rancho(x, y, (130 + it.h * 90) * s, (110 + it.h * 100) * s, ['#ff9a8a', '#8fd0ff', '#ffe08a', '#a8e6a0', '#e0a0ff'][it.i % 5], s);
      else if (it.k === 'palm') palm(x, y, 190 * s, s, T, it.i);
      else if (it.k === 'towers') towers(x, y, 1.4 * s, T);
      else if (it.k === 'hole') {
        const w = 66 * s, hh = 22 * s; el(x, y, w, hh); ink('#2a2638', Math.max(1.5, 3.5 * s)); X.fillStyle = '#56526c'; el(x - w * .08, y - hh * .25, w * .7, hh * .5); X.fill();
        X.strokeStyle = 'rgba(255,255,255,.35)'; X.lineWidth = Math.max(1, 2 * s); el(x, y - hh * .1, w * .9, hh * .8); X.stroke();
      } else if (it.k === 'sign') {
        const st = it.s; line([[x, y], [x, y - 150 * s]], Math.max(2, 7 * s), '#555');
        rr(x - 52 * s, y - 212 * s, 104 * s, 62 * s, 9 * s); ink('#2a6fe0', Math.max(1.5, 3.5 * s));
        X.fillStyle = 'rgba(255,255,255,.3)'; rr(x - 46 * s, y - 207 * s, 92 * s, 10 * s, 4 * s); X.fill();
        txt('BUS STOP', x, y - 178 * s, Math.max(6, 22 * s), '#fff', 'center', 94 * s);
        if (st.st === 0 && s > .12) { caos(x - 62 * s, y, 3 * s, { col: PAL[st.i % 6] }); if (st.i % 2) caos(x - 90 * s, y - 2 * s, 2.6 * s, { col: PAL[(st.i + 3) % 6] }); }
        if (st.st === 0 && Math.abs(it.d) < ZN) { X.strokeStyle = bell[st.i] ? '#5CFF7A' : 'rgba(255,255,255,.6)'; X.lineWidth = Math.max(2, 5 * s); X.setLineDash([10, 8]); rr(sxl(-.45, s), y - 6 * s, 3 * LW * s, 12 * s, 4); X.stroke(); X.setLineDash([]); }
      }
    }
    X.restore();
    // windscreen frame + mirror showing the colector
    X.fillStyle = INK; X.fillRect(0, 0, W, 6); rr(520, 56, 160, 54, 10); ink('#2b2b40', 3.5); X.save(); rr(526, 62, 148, 42, 8); X.clip(); X.fillStyle = '#e9d9b8'; X.fillRect(520, 56, 160, 54);
    X.fillStyle = '#d6453b'; X.fillRect(640 + (lost && rk >= 0 ? clamp(rk / .35, 0, 1) * 36 : 0), 62, 36, 42);
    if (!(lost && rk >= .25)) caos(654, 104, 1.5, { col: D.partner && D.partner.color || '#6EA8FE', mood: won ? 'happy' : lost ? 'sad' : null });
    else { const q = rk - .25; X.save(); X.translate(654 + q * 200, 90 - q * 60 + q * q * 90); X.rotate(q * 9); caos(0, 10, 1.5, { col: pcol() }); X.restore(); }
    X.restore();
    // dashboard
    X.beginPath(); X.moveTo(0, H); X.lineTo(0, 530); X.quadraticCurveTo(400, 462, W, 530); X.lineTo(W, H); X.closePath(); ink('#4a3b66', 5);
    X.fillStyle = 'rgba(255,255,255,.14)'; X.beginPath(); X.moveTo(0, 536); X.quadraticCurveTo(400, 472, W, 536); X.lineTo(W, 548); X.quadraticCurveTo(400, 484, 0, 548); X.closePath(); X.fill();
    // speedo
    X.beginPath(); X.arc(130, 556, 54, 0, TAU); ink('#f4efe0', 4); const a = Math.PI * 1.15 + (v / VM) * Math.PI * .7; line([[130, 556], [130 + Math.cos(a) * 44, 556 + Math.sin(a) * 44]], 5, '#e8434f');
    // the bell lamp
    const lit = lamp && !g.result, bl = lit ? .6 + .4 * Math.sin(T * 14) : 0;
    rr(214, 508, 110, 62, 12); ink('#2b2b40', 3.5);
    X.beginPath(); X.arc(240, 534, 15, 0, TAU); ink(lit ? '#ff3d4d' : '#6b2a30', 3);
    if (lit) { X.save(); X.globalCompositeOperation = 'lighter'; const gr = X.createRadialGradient(240, 534, 4, 240, 534, 60 * (.8 + bl * .4)); gr.addColorStop(0, 'rgba(255,90,100,.9)'); gr.addColorStop(1, 'rgba(255,60,80,0)'); X.fillStyle = gr; X.beginPath(); X.arc(240, 534, 64, 0, TAU); X.fill(); X.restore(); }
    txt('STOP BELL', 288, 534, 15, lit ? '#ffe58a' : '#9a95b8', 'center', 66);
    // pedal
    const press = goT * 10; rr(630, 540 + press, 90, 44, 10); ink('#8a8fa3', 4); X.fillStyle = 'rgba(255,255,255,.25)'; X.fillRect(640, 546 + press, 70, 6);
    // wheel + hands
    X.save(); X.translate(470, 640); X.rotate((laneT - lx) * .35); X.beginPath(); X.arc(0, 0, 118, 0, TAU); X.lineWidth = 22; X.strokeStyle = INK; X.stroke(); X.lineWidth = 12; X.strokeStyle = '#5b4d7a'; X.stroke();
    X.fillStyle = '#5b4d7a'; X.fillRect(-4, -112, 8, 100); X.restore();
    const hy = 512 + Math.sin(T * 9) * 1;
    for (const hx of [380, 560]) { rr(hx - 14, hy - 14, 28, 28, 6); ink(myCol(), 3.5); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(hx - 9, hy - 9, 10, 8); }
    if (T < 3.6 && !g.result) pill(470, 470, 'YOU', myCol());
    hudBar();
    // payoffs on the driver screen
    if (won && rk >= 0) {
      for (let i = 0; i < 26; i++) { const q = (rk * .8 + i * .17) % 1, x = (i * 97) % 800 + Math.sin(rk * 3 + i) * 24, y = -20 + q * 560; bill(x, y, [1, 2, 5, 10][i & 3], rk * 2 + i, .8); }
      for (let i = 0; i < 3; i++) { const q = (rk * 1.6 + i / 3) % 1; X.globalAlpha = (1 - q) * .8; X.lineWidth = 5; X.strokeStyle = '#fff'; X.beginPath(); X.arc(470, 500, 40 + q * 150, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); X.globalAlpha = 1; }
      if (rk > .1) badge('BEEP BEEEEP!', 400, 330, 44, '#ffb23d', '#fff', outBack((rk - .1) / .22) * (rk > 2 ? Math.max(0, 1 - (rk - 2) * 2) : 1), -.06);
      if (rk > .5) badge('UEPA!', 400, 410, 34, '#2fa84a', '#fff', outBack((rk - .5) / .22), .05);
    }
    if (lost && rk >= .2) { badge('THE COLLECTOR FLEW OUT!', 400, 330, 26, '#e8434f', '#fff', outBack((rk - .2) / .25), -.04); }
  }
  const pcol = () => (D.partner && D.partner.color) || '#6EA8FE';

  g.dbg = {
    stops, holes, fares, VM, BR, ZN, BTN,
    /* colector's screen: the hands up (with seat coordinates), the bubble that has not been answered, the jam */
    cview: () => { const T = g.c, hs = handsUp(T).map(f => ({ pax: f.pax, val: f.val, x: PX(f.pax), y: PY(f.pax) - 50, age: T - f.t0 })), a = activeStop(); return { hands: hs, bubble: !!(a && !bell[a.i]), jam: jam > 0, rung: a ? bell[a.i] : false, stops: stopsDone(), fares: fcNet() }; },
    /* chofer's screen: own state, the lamp, signs ahead (distance only), potholes ahead (distance + lane) */
    dview: () => ({ P, v, lx, laneT, lamp, signs: stops.filter(s => !s.st).map(s => ({ d: s.p - P })).filter(s => s.d > -ZN && s.d < 1200), holes: holes.filter(h => !h.hit && h.p - P > -30 && h.p - P < 520).map(h => ({ d: h.p - P, l: h.l })) }),
  };
  wire(g, D, 0, sp, 'du_cobra');
  return g;
}
reg('du_cobra', duCobra, 'COBRA EL PASAJE'); REGMAP.du_cobra.duo = true;

/* ───────────── intro card (520×240 frame), a 4 s loop ───────────── */
function demo(role, tt) {
  X = ctx; const u = tt % 4;
  X.save(); X.beginPath(); X.rect(0, 0, 520, 240); X.clip();
  if (role === 0) {
    X.fillStyle = '#e9d9b8'; X.fillRect(0, 0, 520, 240); X.fillStyle = '#7fd3ff'; X.fillRect(0, 0, 520, 52); X.fillStyle = INK; X.fillRect(0, 50, 520, 6);
    X.fillStyle = '#2f2a46'; X.fillRect(0, 214, 520, 26);
    for (let i = 0; i < 3; i++) { const x = 90 + i * 130, up = (u > .3 + i * .6 && u < 1.2 + i * .9);
      X.save(); X.translate(x, 170); X.scale(.7, .7); passenger(0, 0, i, tt, { hand: up ? [5, 1, 10][i] : 0 }); X.restore(); }
    const bx = 440, by = 150; X.beginPath(); X.arc(bx, by + 4, 40, 0, TAU); ink('#9a1f2b', 3); X.beginPath(); X.arc(bx, by - 2, 36, 0, TAU); ink('#ff3d4d', 3); txt('BUS STOP!', bx, by + 4, 15, '#fff', 'center', 64);
    const f = u < 1.1 ? [90 + Math.floor(u / .4) * 130, 96] : [bx, by - 4]; DUO.demoFinger(Math.min(350, f[0]), f[1] + 20, true, u % .4 / .4 * (u < 1.1 ? 1 : 0)); if (u >= 1.1) DUO.demoFinger(bx, by, true, (u % 1));
    badge('TAP HANDS, RING THE BELL!', 260, 28, 17, '#c98a12', '#fff', 1, -.02);
  } else {
    const sk = X.createLinearGradient(0, 0, 0, 100); sk.addColorStop(0, '#5fbfff'); sk.addColorStop(1, '#ffe7a8'); X.fillStyle = sk; X.fillRect(0, 0, 520, 100); X.fillStyle = '#7cc46a'; X.fillRect(0, 100, 520, 140);
    X.beginPath(); X.moveTo(240, 100); X.lineTo(280, 100); X.lineTo(420, 240); X.lineTo(100, 240); X.closePath(); X.fillStyle = '#6a6c86'; X.fill();
    const near = (u % 2) / 2, sc = .35 + near * .9; X.save(); X.translate(330 + near * 80, 100 + near * 90); X.scale(sc, sc); line([[0, 0], [0, -110]], 7, '#555'); rr(-46, -150, 92, 46, 8); ink('#2a6fe0', 3); txt('BUS STOP', 0, -127, 18, '#fff', 'center', 80); X.restore();
    const lit = u > 1.2 && u < 3; X.beginPath(); X.arc(80, 200, 16, 0, TAU); ink(lit ? '#ff3d4d' : '#6b2a30', 3); txt('STOP BELL', 80, 226, 12, '#fff', 'center', 70);
    rr(300, 190, 90, 40, 10); ink('#8a8fa3', 3); DUO.demoFinger(345, 205, u < 2.4, (u % 1));
    badge('STOP ONLY WHEN THE BELL RINGS!', 260, 28, 15, '#2b9ee6', '#fff', 1, -.02);
  }
  X.restore();
}
DUO.INFO.du_cobra = [['COLLECTOR', 'COLLECT FARES, RING THE BELL', 'TAP HANDS + BUS STOP!'], ['DRIVER', 'DRIVE, STOP WHEN THE BELL RINGS', 'HOLD TO GO, DRAG TO DODGE']];
DUO.DEMOS.du_cobra = [t => demo(0, t), t => demo(1, t)];

})();
