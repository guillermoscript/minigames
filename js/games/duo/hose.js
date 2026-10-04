'use strict';
/* ═════════ DUO · HOSE & MOP (du_hose), after Squeaky-Clean (Move It!) ═════════
   A dog show is about to start and the ring floor is covered in mud. Dry mud is baked hard: a mop barely moves it.
   HOSE (role 0): aims a water jet (pointer / arrows) and holds to spray (click, touch, Space). The jet runs on pressure that drains
   while spraying and refills while resting; empty = it sputters until it has refilled a bit. Mud hit by the jet turns shiny-wet for WET s.
   MOPPER (role 1, JUDGE): moves the mop (pointer / arrows) and scrubs by moving it back and forth (or mashing A / D). Wet mud comes off
   fast, dry mud hardly at all, so the mop needs the water and the water needs the mop. A jet that hits the mopper knocks it over (SPLOOSH).
   One of the stains is secretly a sleeping mud-coloured dog: water wakes it and it runs off (scrubbing it only makes it growl).
   Clean all NEED real stains before the time runs out = the judge awards the floor a trophy.
   Netcode: the HOSE owns wetness: 'wet' i when its jet soaks stain i (and every WEVERY s while it keeps soaking it), plus 'aim' [x, y, on]
   (coalesced, ≤10/s) so the mopper sees the jet. The MOPPER owns the mud: 'hp' [h0..h5 ×100] (coalesced, ≤7/s), 'gone' [i, n] when a
   stain is clean, 'mop' [x, y] (coalesced, ≤10/s), 'slip' when the jet (as it sees it) hits its body, 'ask' i when it scrubs dry mud
   (the hose's screen shows "WET IT!" over that stain). The mopper counts the cleaned stains and sends the verdict ('end', via wire). */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
const MC = new Map();
const mix = (a, b, k) => { k = Math.round(clamp(k, 0, 1) * 40) / 40; const key = a + b + k; let v = MC.get(key); if (v) return v; const A = rgb(a), B = rgb(b); v = '#' + A.map((q, i) => Math.round(q + (B[i] - q) * k).toString(16).padStart(2, '0')).join(''); MC.set(key, v); return v; };

/* ───────────── layout (800×600; HUD keeps y<58, the top-left box, the top-right LEAVE and y>552) ───────────── */
const FLOOR = 214;                                    // where the back wall meets the ring floor
const SQ = .62;                                       // the floor is seen at 3/4: a round stain is an ellipse r × r·SQ
const HX = 84, HY = 530;                              // the hose holder's feet (front left)
const NZ = [134, 496];                                // where the jet leaves the nozzle
const BOFF = [64, -54];                               // the mopper's feet relative to the mop head; its body centre is BOFF + (0, -24)
const BODYR = 38;                                     // the jet knocks the mopper over inside this radius around its body centre
const MINX = 70, MAXX = 735, MINY = 248, MAXY = 532;  // where the mop head / the aim can go
const TANK = [16, 296, 32, 120];                      // the pressure tank (x, y, w, h)

/* palette */
const MUD = '#7b4a26', MUD2 = '#4f2c14', MUDL = '#a26a3a', MUDW = '#5b3519';   // dry mud: base, shade, crust; wet mud base
const TILE1 = '#fff3dc', TILE2 = '#f7dfb4';
const WATER = '#5fd0ff', WATER2 = '#2b9ee6', FOAM = '#eafaff';
const HOSEG = '#43b649', HOSEG2 = '#26823a';
const GOLD = '#ffcf33', GOLD2 = '#d99a12';
const STRAND = '#f3efe6', STRAND2 = '#c9c0ad';

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
const PM = {}; const P = d => PM[d] || (PM[d] = new Path2D(d));
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function line(pts, w, col) { X.beginPath(); pts.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function pill(x, y, label, col) {                     // a name tag with a little pointer down, e.g. YOU / YOUR FRIEND
  X.font = '700 17px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = t(label), w = Math.min(170, X.measureText(s).width + 26);
  X.beginPath(); X.moveTo(x - 9, y + 13); X.lineTo(x, y + 24); X.lineTo(x + 9, y + 13); X.closePath(); ink(col, 3);
  rr(x - w / 2, y - 14, w, 28, 14); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 11, w - 12, 7, 3.5); X.fill();
  txt(label, x, y + 1, 17, INK, 'center', w - 14);
}
/* a word on a chunky coloured badge (feedback that stays readable over any background) */
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
/* a speech bubble with a tail pointing down to (x, y) */
function bubble(s, x, y, size, sc) {
  if (sc <= .01) return;
  X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const w = Math.min(200, X.measureText(t(s)).width) + 26, h = size * 1.5;
  X.save(); X.translate(x, y); X.scale(sc, sc);
  X.beginPath(); X.moveTo(-8, -18); X.lineTo(2, 0); X.lineTo(10, -18); X.closePath(); ink('#fff', 3);
  rr(-w / 2, -18 - h, w, h, h * .45); ink('#fff', 3);
  X.fillStyle = '#fff'; X.fillRect(-6, -21, 15, 6);
  txt(s, 0, -18 - h / 2 + 2, size, INK, 'center', 200); X.restore();
}
/* two thin blocky arms from claude()'s side stubs (drawn before claude(), so the body hides the shoulders); a = angle (0 = up), k = 0..1 raised */
function arm(u, sx, an, k, col) {
  if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
  X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
  X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
  X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4);
  X.restore();
}
function drop(x, y, r, col) {                         // a water drop (point up)
  X.beginPath(); X.moveTo(x, y - r * 1.7); X.quadraticCurveTo(x + r * 1.1, y - r * .2, x, y + r); X.quadraticCurveTo(x - r * 1.1, y - r * .2, x, y - r * 1.7); X.closePath();
  ink(col || WATER, 2); X.fillStyle = 'rgba(255,255,255,.75)'; el(x - r * .3, y - r * .3, r * .28, r * .4, -.4); X.fill();
}
function bubbleBall(x, y, r, a) {                     // a soap bubble
  X.globalAlpha = a; X.beginPath(); X.arc(x, y, r, 0, TAU); X.fillStyle = 'rgba(220,245,255,.35)'; X.fill(); X.lineWidth = 2.5; X.strokeStyle = 'rgba(30,60,90,.75)'; X.stroke();
  X.fillStyle = 'rgba(255,255,255,.9)'; el(x - r * .35, y - r * .35, r * .3, r * .2, -.6); X.fill(); X.globalAlpha = 1;
}

/* ───────────── mud ───────────── */
/* a lumpy blob from seeded lobe radii (L: n values ~1), squashed onto the floor */
function blob(x, y, r, L, sc, sq = SQ) {
  const n = L.length, pts = L.map((l, i) => { const a = i / n * TAU; return [x + Math.cos(a) * r * l * sc, y + Math.sin(a) * r * l * sc * sq]; });
  X.beginPath(); const m0 = [(pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2]; X.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; X.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  X.closePath();
}
/* one stain. w: 0..1 how wet (fades in / out), hp: 0..1 left, dog: draw the sleeping-dog tells (ear, tail, a closed eye, breathing) */
function stain(s, T, w, hp, dog) {
  if (hp <= 0) return;
  const sc = (.38 + .62 * hp) * (dog ? 1 + Math.sin(T * 2.6) * .035 : 1), x = s.x, y = s.y, r = s.r;
  // a puddle of water around a wet stain
  if (w > 0) { X.globalAlpha = w * .8; blob(x, y + 2, r + 14, s.L2, sc * 1.05); ink('rgba(150,225,255,.55)', 0); X.lineWidth = 3; X.strokeStyle = 'rgba(60,170,230,.6)'; X.stroke(); X.globalAlpha = 1; }
  // splatter dots
  for (const [a, d, q] of s.sp) { const px = x + Math.cos(a) * r * d * (.6 + .4 * sc), py = y + Math.sin(a) * r * d * SQ * (.6 + .4 * sc); el(px, py, q * sc, q * sc * SQ * 1.2); ink(w > .5 ? MUDW : MUD, 2); }
  if (dog) {                                          // a floppy ear and a tail tip poke out of the "mud"
    const tw = Math.sin(T * 1.7) > .8 ? Math.sin(T * 30) * .3 : 0;
    X.save(); X.translate(x - r * .78 * sc, y - r * .3 * sc); X.rotate(-.5); el(0, 0, 11 * sc, 17 * sc); ink(w > .5 ? MUDW : MUD2, 3); X.restore();
    X.save(); X.translate(x + r * .92 * sc, y + r * .1 * sc); X.rotate(.6 + tw); X.beginPath(); X.moveTo(0, 0); X.quadraticCurveTo(14 * sc, -8 * sc, 18 * sc, -20 * sc); X.lineWidth = 13 * sc; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); X.lineWidth = 6 * sc; X.strokeStyle = w > .5 ? MUDW : MUD; X.stroke(); X.restore();
  }
  blob(x, y, r, s.L, sc); ink(mix(MUD, MUDW, w), 3.5);
  X.save(); blob(x, y, r, s.L, sc); X.clip();
  // crust (dry) / dark soak (wet), shading on the far side
  X.fillStyle = mix(MUDL, '#6e4426', w); blob(x - r * .12 * sc, y - r * .14 * sc, r * .78, s.L, sc); X.fill();
  X.fillStyle = mix(MUD, MUDW, w); blob(x - r * .02 * sc, y + r * .02 * sc, r * .62, s.L2, sc); X.fill();
  if (w < .99) {                                      // dry: baked cracks
    X.globalAlpha = 1 - w; X.strokeStyle = MUD2; X.lineWidth = 2.6; X.lineCap = 'round';
    for (const c of s.cr) { X.beginPath(); c.forEach(([a, d], i) => { const px = x + Math.cos(a) * r * d * sc, py = y + Math.sin(a) * r * d * SQ * sc; i ? X.lineTo(px, py) : X.moveTo(px, py); }); X.stroke(); }
    X.fillStyle = 'rgba(255,230,190,.35)'; for (const [a, d] of s.cr.map(c => c[1])) { el(x + Math.cos(a) * r * d * sc - 3, y + Math.sin(a) * r * d * SQ * sc - 2, 4 * sc, 2 * sc); X.fill(); }
    X.globalAlpha = 1;
  }
  if (w > 0) {                                        // wet: a blue sheen and glossy highlights that shimmer
    X.globalAlpha = w; X.fillStyle = 'rgba(90,170,255,.13)'; X.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
    X.fillStyle = 'rgba(255,255,255,.85)'; el(x - r * .34 * sc, y - r * .2 * SQ * sc, r * .32 * sc, r * .1 * sc, -.15); X.fill();
    el(x + r * .3 * sc + Math.sin(T * 4) * 2, y + r * .22 * SQ * sc, r * .14 * sc, r * .05 * sc, -.15); X.fill();
    X.fillStyle = 'rgba(255,255,255,.55)'; el(x - r * .05 * sc, y - r * .36 * SQ * sc, r * .1 * sc, r * .04 * sc); X.fill();
    X.globalAlpha = 1;
  }
  X.restore();
  if (dog) {                                          // a closed sleepy eye + a nose: you have to look twice
    X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.arc(x - r * .38 * sc, y - r * .12 * sc, 6 * sc, .2, Math.PI - .2); X.stroke();
    el(x - r * .7 * sc, y + r * .06 * sc, 4.5 * sc, 3.4 * sc); X.fillStyle = INK; X.fill();
  }
}
/* the wet timer: a thin ring of water that empties as the stain dries */
function wetRing(s, k, hp) {
  if (k <= 0) return; const sc = .38 + .62 * hp, rx = s.r * sc + 20, ry = (s.r * sc + 20) * SQ;
  X.lineCap = 'round'; X.lineWidth = 9; X.strokeStyle = 'rgba(20,16,28,.55)'; X.beginPath(); X.ellipse(s.x, s.y, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + TAU * k); X.stroke();
  X.lineWidth = 4.5; X.strokeStyle = k < .3 ? '#ffd23f' : WATER; X.stroke();
}

/* ───────────── the dog that was a stain ───────────── */
/* x, y = feet; dir = -1 runs left / 1 runs right; ph = run phase; mood: 'wake' | 'shake' | 'run'; mud = 0..1 dirty */
function dogSprite(x, y, s, dir, ph, mood, T, col) {
  X.save(); X.translate(x, y); X.scale(s * dir, s);
  const run = mood === 'run', wig = mood === 'shake' ? Math.sin(T * 50) * .22 : 0, bob = run ? -Math.abs(Math.sin(ph)) * 8 : 0;
  X.translate(0, bob); X.rotate(wig * .3);
  const c = col || MUDL, c2 = mix(c, INK, .3);
  // legs
  for (const [lx, o] of [[-22, 0], [-12, Math.PI], [16, Math.PI / 2], [26, Math.PI * 1.5]]) { const a = run ? Math.sin(ph + o) * .8 : 0; X.save(); X.translate(lx, -18); X.rotate(a); rr(-4.5, 0, 9, 20, 4); ink(c2, 3); X.restore(); }
  // tail
  X.save(); X.translate(-32, -36); X.rotate(-.9 + Math.sin(T * 18) * .4); X.beginPath(); X.moveTo(0, 0); X.quadraticCurveTo(-6, -14, 0, -24); X.lineWidth = 12; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); X.lineWidth = 6; X.strokeStyle = c; X.stroke(); X.restore();
  // body + mud splodges
  el(0, -32, 36, 19); ink(c, 3.5); X.save(); el(0, -32, 36, 19); X.clip(); X.fillStyle = mix(c, '#ffffff', .25); el(-6, -42, 24, 7); X.fill(); X.fillStyle = MUD; el(10, -26, 12, 7); X.fill(); el(-18, -34, 8, 6); X.fill(); X.restore();
  // head
  X.save(); X.translate(34, -52); X.rotate(wig);
  el(-4, 6, 13, 18, .5); ink(c2, 3);                  // ear (back)
  X.beginPath(); X.arc(0, 0, 19, 0, TAU); ink(c, 3.5);
  el(16, 6, 13, 9); ink(mix(c, '#ffffff', .35), 3); el(27, 2, 5, 4); X.fillStyle = INK; X.fill();
  const wide = mood === 'wake';
  el(4, -4, wide ? 8 : 6.5, wide ? 9 : 7.5); ink('#fff', 2.5); X.fillStyle = INK; el(6, -3, wide ? 3 : 3.6, wide ? 3 : 4); X.fill();
  if (run) { X.beginPath(); X.moveTo(12, 12); X.quadraticCurveTo(18, 22, 24, 12); ink('#ff7ea8', 2.5); }
  X.save(); X.translate(-10, -6); X.rotate(-.4 + (run ? Math.sin(ph * 2) * .5 : -.6)); el(0, 12, 9, 15); ink(c2, 3); X.restore();   // floppy ear (front)
  X.restore();
  X.restore();
}

/* ───────────── the people ───────────── */
/* the mop: a stick from the hands down to a yarn head at (hx, hy); sw = sway of the strands (scrub speed, signed); dirt 0..1 */
function mopHead(hx, hy, sw, dirt, T, wet) {
  const n = 11;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) {   // thick cotton strands splay out on the floor (outline pass, then colour)
    const a = (i / (n - 1) - .5), sx = hx + a * 40, ex = hx + a * 84 - sw * 16 + Math.sin(T * 9 + i) * 1.5, ey = hy + 8 + Math.abs(a) * -10 + (i % 2) * 5;
    const col = mix(i % 2 ? STRAND : STRAND2, '#8a6a4c', dirt * (.5 + (i % 3) * .2));
    X.beginPath(); X.moveTo(sx, hy - 10); X.bezierCurveTo(sx - sw * 6, hy + 2, lerp(sx, ex, .7) + Math.sin(i * 2.3) * 6, ey - 2, ex, ey);
    X.lineCap = 'round'; X.lineWidth = pass ? 9 : 16; X.strokeStyle = pass ? col : INK; X.stroke();
  }
  el(hx, hy - 10, 22, 9); ink('#4db8ff', 3); X.fillStyle = 'rgba(255,255,255,.5)'; el(hx - 6, hy - 13, 10, 2.5); X.fill();
  if (wet) { X.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 4; i++) { el(hx - 27 + i * 18, hy + 6 + (i % 2) * 3, 3.4, 1.6); X.fill(); } }
}
/* the mopper: feet at (bx, by), its mop head at (hx, hy). fall: 0..1 knocked over; sw: strand sway; mood for claude() */
function mopper(bx, by, hx, hy, col, mood, sw, dirt, fall, T, wet) {
  const u = 4.3;
  if (fall > 0) {                                     // SPLOOSH: flat on its back, legs up, mop flung aside
    const k = ease(fall);
    shadow(bx, by + 2, 40, 9, .25);
    mopHead(hx + 30 * k, hy + 6 * k, 0, dirt, T, wet);
    X.save(); X.translate(bx, by - 8 * (1 - k)); X.rotate(-Math.PI / 2 * k); claude(0, 0, u, { col, mood: 'sad' }); X.restore();
    for (let i = 0; i < 3; i++) { const a = T * 7 + i * TAU / 3; star(bx - 20 + Math.cos(a) * 30, by - 52 + Math.sin(a) * 9, 9, 4, 5, a, '#FFE14D', 3); }
    return;
  }
  shadow(bx, by + 1, 34, 8, .22);
  const an = -.5 - sw * .12, d = 3.3 * u * .9 + .35 * u + u, hand = [bx - 6.6 * u + d * Math.sin(an), by - 5.2 * u - d * Math.cos(an)];
  X.save(); X.translate(bx, by); arm(u, -1, an, .9, col); X.restore();
  claude(bx, by, u, { col, mood });
  // the stick goes from the raised hand down to the mop head (in front of the body), the hand grips it
  X.lineCap = 'round'; X.lineWidth = 12; X.strokeStyle = INK; X.beginPath(); X.moveTo(hand[0] + (hand[0] - hx) * .12, hand[1] + (hand[1] - hy) * .12); X.lineTo(hx, hy - 12); X.stroke();
  X.lineWidth = 6; X.strokeStyle = '#d9a066'; X.stroke();
  const hs = 2 * u; X.fillStyle = INK; X.fillRect(hand[0] - hs / 2 - 3, hand[1] - hs / 2 - 3, hs + 6, hs + 6); X.fillStyle = col; X.fillRect(hand[0] - hs / 2, hand[1] - hs / 2, hs, hs);
  mopHead(hx, hy, sw, dirt, T, wet);
}
/* the hose holder at (HX, HY) aiming at (ax, ay): body, arms on the nozzle, a garden-hose loop back to the reel */
function hoser(ax, ay, col, mood, spray, T, recoil, cheer) {
  const u = 5, dx = ax - NZ[0], dy = ay - NZ[1], an = Math.atan2(dy, dx);
  // the reel and the tank stand behind
  X.save(); X.translate(40, 502); X.rotate(T * (spray ? 6 : .4)); X.beginPath(); X.arc(0, 0, 24, 0, TAU); ink('#ff6b4d', 3.5);
  X.beginPath(); X.arc(0, 0, 16, 0, TAU); ink(HOSEG, 3); X.fillStyle = INK; X.fillRect(-2, -16, 4, 32); X.fillRect(-16, -2, 32, 4); X.restore();
  // garden hose: reel -> under the holder -> up to the nozzle
  X.beginPath(); X.moveTo(40, 502); X.bezierCurveTo(66, 552, 136, 552, 128, 512); X.quadraticCurveTo(124, 498, NZ[0] - 10, NZ[1] + 6);
  X.lineCap = 'round'; X.lineWidth = 15; X.strokeStyle = INK; X.stroke(); X.lineWidth = 8; X.strokeStyle = HOSEG; X.stroke(); X.lineWidth = 2.5; X.strokeStyle = 'rgba(255,255,255,.45)'; X.stroke();
  X.save(); X.translate(HX, HY + recoil * 3);
  if (cheer) { const w = Math.sin(T * 14) * .3; arm(u, -1, -.45 + w, 1, col); arm(u, 1, .45 - w, 1, col); }
  else { const a2 = an + Math.PI / 2; arm(u, 1, clamp(a2, .2, 2.6) - .15 * recoil, .85, col); }
  claude(0, 0, u, { col, mood });
  X.restore();
  if (cheer) return;
  // the brass nozzle points at the target
  X.save(); X.translate(NZ[0], NZ[1]); X.rotate(an); X.translate(-recoil * 4, 0);
  rr(-22, -8, 26, 16, 5); ink('#ffcf33', 3); X.fillStyle = 'rgba(255,255,255,.5)'; X.fillRect(-18, -5, 18, 3);
  rr(2, -6, 12, 12, 3); ink('#d99a12', 3);
  X.restore();
}
/* the water jet: a fat arc from the nozzle to (ax, ay); k: 0..1 pressure look (thin when low); dry: it sputters */
function jet(ax, ay, k, dry, T) {
  const dx = ax - NZ[0], dy = ay - NZ[1], d = Math.hypot(dx, dy), lift = 50 + d * .22;
  const C = [(NZ[0] + ax) / 2, Math.min(NZ[1], ay) - lift];
  const at = u => { const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u; return [a * NZ[0] + b * C[0] + c * ax, a * NZ[1] + b * C[1] + c * ay]; };
  if (dry) {                                          // sputter: a few blobs near the nozzle
    for (let i = 0; i < 4; i++) { const u = ((T * 3 + i * .25) % 1) * .3, [px, py] = at(u); drop(px, py + u * 60, 5 - i * .6); }
    return;
  }
  const w = 6 + 7 * k, pts = []; for (let i = 0; i <= 24; i++) pts.push(at(i / 24));
  line(pts, w + 8, INK); line(pts, w, WATER); line(pts, w * .4, FOAM);
  X.setLineDash([10, 16]); X.lineDashOffset = -T * 260; line(pts, w * .25, '#fff'); X.setLineDash([]);
  for (let i = 0; i < 5; i++) { const u = ((T * 2.2 + i / 5) % 1), [px, py] = at(u); drop(px + Math.sin(i * 7 + T * 20) * 8, py + 10 + Math.cos(i * 3) * 4, 3.2); }
  // the splash where it lands
  const s = 1 + Math.sin(T * 30) * .08;
  el(ax, ay, 34 * s, 34 * SQ * s); ink('rgba(170,232,255,.75)', 3);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI + Math.PI + Math.sin(T * 25 + i) * .15, L = 22 + ((T * 90 + i * 13) % 18); drop(ax + Math.cos(a) * L, ay + Math.sin(a) * L * .9 - 6, 4); }
}
/* the pressure tank on the left wall: water level k, red when sputtering */
function tank(k, dry, T) {
  const [x, y, w, h] = TANK;
  rr(x, y, w, h, 12); ink('#e8f3ff', 4);
  X.save(); rr(x, y, w, h, 12); X.clip();
  const lv = y + h - h * k, wv = Math.sin(T * 6) * 2;
  X.fillStyle = dry ? '#ff8a8a' : WATER; X.beginPath(); X.moveTo(x, lv + wv); X.lineTo(x + w, lv - wv); X.lineTo(x + w, y + h); X.lineTo(x, y + h); X.fill();
  X.fillStyle = 'rgba(255,255,255,.55)'; X.fillRect(x + 5, y + 6, 6, h - 12);
  if (!dry) for (let i = 0; i < 3; i++) { const q = (T * .8 + i / 3) % 1, by = y + h - q * h * k; if (by > lv) { X.beginPath(); X.arc(x + 12 + i * 7, by, 2.5, 0, TAU); X.fill(); } }
  X.restore();
  rr(x, y, w, h, 12); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
  X.fillStyle = INK; for (let i = 1; i < 4; i++) X.fillRect(x + w - 10, y + i * h / 4, 10, 3);
  if (dry && Math.sin(T * 12) > 0) txt('!', x + w / 2, y - 16, 30, '#ff4d4d');
}
/* a big gold trophy, base at (x, y) */
function trophy(x, y, s, T) {
  X.save(); X.translate(x, y); X.scale(s, s);
  rr(-36, -22, 72, 22, 5); ink('#5a3b2e', 4); X.fillStyle = '#7a5040'; X.fillRect(-32, -18, 64, 4);
  rr(-12, -52, 24, 32, 4); ink(GOLD2, 4);
  for (const sx of [-1, 1]) { X.beginPath(); X.ellipse(sx * 44, -96, 16, 22, 0, 0, TAU); X.lineWidth = 16; X.strokeStyle = INK; X.stroke(); X.lineWidth = 8; X.strokeStyle = GOLD; X.stroke(); }
  X.beginPath(); X.moveTo(-46, -136); X.lineTo(46, -136); X.quadraticCurveTo(44, -56, 0, -50); X.quadraticCurveTo(-44, -56, -46, -136); X.closePath(); ink(GOLD, 4);
  X.fillStyle = 'rgba(255,255,255,.55)'; el(-22, -110, 7, 20, .15); X.fill();
  X.fillStyle = GOLD2; X.fillRect(-46, -140, 92, 8); X.lineWidth = 4; X.strokeStyle = INK; X.strokeRect(-46, -140, 92, 8);
  star(0, -98, 18, 8, 5, 0, '#fff4b0', 3);
  X.restore();
  star(x + 40 * s, y - 140 * s, 10 + Math.sin(T * 12) * 4, 3, 4, T, '#fff', 0);
}
/* the show judge: a basset hound in a bow tie, rising from the bottom-right corner with a score card */
function judge(x, y, s, card, T, sad) {
  X.save(); X.translate(x, y); X.scale(s, s);
  rr(-60, -30, 120, 90, 30); ink('#2f2a4a', 4);                 // suit
  X.beginPath(); X.moveTo(-14, -26); X.lineTo(0, -12); X.lineTo(14, -26); X.closePath(); ink('#fff', 3);
  X.beginPath(); X.moveTo(-18, -22); X.lineTo(0, -14); X.lineTo(-18, -6); X.closePath(); ink('#ff4d6d', 3); X.beginPath(); X.moveTo(18, -22); X.lineTo(0, -14); X.lineTo(18, -6); X.closePath(); ink('#ff4d6d', 3);
  for (const sx of [-1, 1]) { X.save(); X.translate(sx * 44, -82); X.rotate(sx * .25 + (sad ? sx * .3 : 0)); el(0, 30, 16, 40); ink('#8a5a33', 3.5); X.restore(); }   // long ears
  X.beginPath(); X.arc(0, -84, 42, 0, TAU); ink('#e8b878', 4);
  el(0, -64, 26, 18); ink('#f7dcb0', 3); el(0, -72, 10, 7); X.fillStyle = INK; X.fill();
  for (const sx of [-1, 1]) { el(sx * 16, -96, 9, sad ? 4 : 8); ink('#fff', 2.5); X.fillStyle = INK; el(sx * 16, -94, 3.5, 3.5); X.fill(); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(sx * 26, -106); X.lineTo(sx * 6, sad ? -102 : -110); X.stroke(); }
  X.beginPath(); X.arc(16, -96, 13, 0, TAU); X.lineWidth = 3; X.strokeStyle = GOLD2; X.stroke(); X.beginPath(); X.moveTo(28, -92); X.quadraticCurveTo(34, -70, 30, -50); X.lineWidth = 2; X.stroke();   // monocle
  if (card) {                                          // score card held up on a stick
    X.save(); X.translate(-70, -120); X.rotate(-.1 + Math.sin(T * 6) * .05); rr(-4, 0, 8, 70, 3); ink('#d9a066', 3); rr(-38, -56, 76, 60, 8); ink('#fff', 4);
    txt(card, 0, -24, 46, sad ? '#e8434f' : INK); X.restore();
  }
  X.restore();
}
/* a fluffy white show poodle (the losing gag): feet at (x, y), mud 0..1, ph = trot phase, shock */
function poodle(x, y, s, mud, ph, shock, T) {
  const c = mix('#ffffff', '#8a5a33', mud), c2 = mix('#e6e0f2', MUD2, mud);
  X.save(); X.translate(x, y); X.scale(-s, s);
  for (const [lx, o] of [[-18, 0], [-8, Math.PI], [18, Math.PI / 2], [26, Math.PI * 1.5]]) { const a = Math.sin(ph + o) * .5; X.save(); X.translate(lx, -30); X.rotate(a); X.fillStyle = INK; X.fillRect(-4, 0, 8, 26); X.fillStyle = c2; X.fillRect(-2, 0, 4, 24); X.beginPath(); X.arc(0, 26, 7, 0, TAU); ink(c, 3); X.restore(); }
  X.save(); X.translate(-32, -52); X.rotate(-.6); X.fillStyle = INK; X.fillRect(-3, -16, 6, 18); X.beginPath(); X.arc(0, -20, 10, 0, TAU); ink(c, 3); X.restore();
  el(2, -42, 30, 14); ink(c2, 3);
  X.beginPath(); X.arc(-16, -46, 18, 0, TAU); ink(c, 3);               // the hip pompom
  X.beginPath(); X.arc(18, -50, 20, 0, TAU); ink(c, 3);                // the chest mane
  X.save(); X.translate(34, -76);
  for (const [a, b, q] of [[-10, 2, 10], [10, 2, 10], [0, -14, 12]]) { X.beginPath(); X.arc(a, b, q, 0, TAU); ink(c, 3); }   // ears + topknot
  X.beginPath(); X.arc(0, 0, 13, 0, TAU); ink(c2, 3); el(14, 4, 11, 6); ink(c2, 3); el(24, 3, 4, 3); X.fillStyle = INK; X.fill();
  if (shock) { el(3, -3, 6, 7); ink('#fff', 2); X.fillStyle = INK; el(4, -3, 2, 2); X.fill(); X.beginPath(); X.arc(16, 12, 4, 0, TAU); ink('#3a1830', 2); }
  else { X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.arc(3, -2, 5, Math.PI + .3, -.3); X.stroke(); }
  X.restore();
  if (mud > .3) { X.fillStyle = MUD; el(-14, -40, 10, 7); X.fill(); el(14, -52, 8, 6); X.fill(); el(-4, -30, 7, 4); X.fill(); }
  X.restore();
  if (mud > .5) for (let i = 0; i < 2; i++) { const a = T * 9 + i * 3; X.fillStyle = INK; el(x + Math.cos(a) * 30, y - 90 + Math.sin(a * 1.3) * 10, 3, 2.4); X.fill(); }
}

/* ───────────── the static scene, painted once into an offscreen canvas ───────────── */
const FANS = [];                                      // spectator dogs in the stands: their pupils are drawn live (they follow the jet)
let BG = null, BGV = -1;
function buildBg(variant) {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d'); FANS.length = 0;
  // arena wall
  let g = X.createLinearGradient(0, 0, 0, FLOOR); g.addColorStop(0, '#3b2a6e'); g.addColorStop(1, '#6a4bb8'); X.fillStyle = g; X.fillRect(0, 0, W, FLOOR);
  // stands: three stepped rows of seats with spectator dogs
  const rows = [[118, '#8b6fd6'], [154, '#9d84e0'], [190, '#b29ceb']];
  rows.forEach(([y, c], ri) => {
    X.fillStyle = c; X.fillRect(0, y - 8, W, 30); X.fillStyle = 'rgba(20,16,28,.35)'; X.fillRect(0, y + 18, W, 4);
    X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, y - 8); X.lineTo(W, y - 8); X.stroke();
    for (let i = 0; i < 9; i++) {
      const x = 46 + i * 88 + (ri % 2) * 44 + ((i * 37 + ri * 11) % 17) - 8; if (x > W - 20) continue;
      if (ri <= 1 && x > 250 && x < 550) continue;     // the banner hangs there (it would hide these seats)
      const kind = (i * 7 + ri * 3) % 5, fur = ['#e8b878', '#fff3e0', '#8a5a33', '#3a3550', '#f2d49b'][(i + ri * 2) % 5];
      const special = ri === 2 && i === 4 ? (variant ? 'hotdog' : 'cat') : null;
      X.save(); X.translate(x, y - 10);
      if (special === 'hotdog') {                      // the rare one: a hot dog came to watch (sitting up, so the rope doesn't hide the bun)
        X.translate(0, -8); rr(-26, -6, 52, 20, 10); ink('#f2b25c', 3); rr(-30, -14, 60, 14, 7); ink('#d9573b', 3);
        X.strokeStyle = '#ffd23f'; X.lineWidth = 3; X.beginPath(); for (let k = 0; k < 6; k++) X.lineTo(-22 + k * 9, -10 + (k % 2) * 5); X.stroke();
        FANS.push({ x: x - 8, y: y - 28, r: 4, two: true, gap: 16 });
      } else if (special === 'cat') {                  // ...and a cat wearing a dog-ears headband
        for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * 8, -20); X.lineTo(sx * 18, -34); X.lineTo(sx * 20, -14); X.closePath(); ink('#ff9a4d', 3); }
        X.beginPath(); X.arc(0, -8, 18, 0, TAU); ink('#ff9a4d', 3);
        X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.arc(0, -10, 21, Math.PI * 1.1, Math.PI * 1.9); X.stroke();
        for (const sx of [-1, 1]) { X.save(); X.translate(sx * 20, -18); X.rotate(sx * .3); el(0, 10, 7, 13); ink('#8a5a33', 2.5); X.restore(); }
        X.strokeStyle = INK; X.lineWidth = 2; for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * 8, -2); X.lineTo(sx * 22, -4); X.moveTo(sx * 8, 1); X.lineTo(sx * 22, 3); X.stroke(); }
        FANS.push({ x, y: y - 22, r: 5, two: true, gap: 13, slit: true });
      } else {
        if (kind < 2) for (const sx of [-1, 1]) { X.save(); X.translate(sx * 15, -18); X.rotate(sx * .35); el(0, 10, 7, 14); ink(mix(fur, INK, .35), 2.5); X.restore(); }   // floppy ears
        else if (kind < 4) for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * 6, -20); X.lineTo(sx * 15, -36); X.lineTo(sx * 18, -14); X.closePath(); ink(mix(fur, INK, .2), 2.5); }   // pointy ears
        X.beginPath(); X.arc(0, -8, 17, 0, TAU); ink(fur, 3);
        el(0, 2, 10, 7); ink(mix(fur, '#ffffff', .4), 2.5); el(0, -1, 4, 3); X.fillStyle = INK; X.fill();
        if (kind === 4) { X.fillStyle = '#ff4d6d'; X.beginPath(); X.moveTo(-8, 10); X.lineTo(0, 14); X.lineTo(8, 10); X.lineTo(8, 18); X.lineTo(0, 14); X.lineTo(-8, 18); X.fill(); }   // a bow tie
        FANS.push({ x, y: y - 20, r: 4.2, two: true, gap: 13 });
      }
      X.restore();
    }
  });
  // the "BEST IN SHOW" banner (text drawn live), two spot lamps
  rr(262, 64, 276, 80, 10); ink('#ff4d6d', 4); X.fillStyle = '#d93a57'; X.fillRect(262, 124, 276, 6);
  for (const sx of [262, 538]) { X.beginPath(); X.moveTo(sx, 144); X.lineTo(sx + (sx < 400 ? 0 : -0), 164); X.lineTo(sx + (sx < 400 ? 22 : -22), 144); X.closePath(); ink('#ff4d6d', 3); }
  // the ring floor: cream tiles in perspective
  g = X.createLinearGradient(0, FLOOR, 0, H); g.addColorStop(0, '#f3d9a9'); g.addColorStop(1, '#fff3dc'); X.fillStyle = g; X.fillRect(0, FLOOR, W, H - FLOOR);
  const VP = [400, -520], rowsY = []; for (let i = 0, y = FLOOR; y < H + 60; i++) { rowsY.push(y); y += 22 + i * 9; }
  const xAt = (x0, y) => VP[0] + (x0 - VP[0]) * (y - VP[1]) / (H - VP[1]);
  for (let r = 0; r < rowsY.length - 1; r++) for (let c = -8; c < 9; c++) {
    if ((r + c) % 2) continue; const y0 = rowsY[r], y1 = rowsY[r + 1], a = -60 + c * 92, b = a + 92;
    X.fillStyle = TILE2; X.beginPath(); X.moveTo(xAt(a, y0), y0); X.lineTo(xAt(b, y0), y0); X.lineTo(xAt(b, y1), y1); X.lineTo(xAt(a, y1), y1); X.closePath(); X.fill();
  }
  X.fillStyle = 'rgba(255,255,255,.18)'; for (let i = -4; i < 12; i++) { X.beginPath(); X.moveTo(i * 90, H); X.lineTo(i * 90 + 40, H); X.lineTo(i * 90 + 150, FLOOR); X.lineTo(i * 90 + 110, FLOOR); X.fill(); }
  // ring rope + posts along the back edge
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, FLOOR); X.lineTo(W, FLOOR); X.stroke();
  for (let x = 30; x < W; x += 148) { rr(x - 6, FLOOR - 40, 12, 46, 4); ink('#fff', 3); X.beginPath(); X.arc(x, FLOOR - 42, 8, 0, TAU); ink(GOLD, 3); }
  X.lineWidth = 9; X.strokeStyle = INK; X.beginPath(); for (let x = 30; x < W; x += 148) { X.moveTo(x, FLOOR - 30); X.quadraticCurveTo(x + 74, FLOOR - 18, x + 148, FLOOR - 30); } X.stroke();
  X.lineWidth = 5; X.strokeStyle = '#ff4d6d'; X.stroke();
  // a bucket in the corner (back right)
  X.save(); X.translate(744, 262); X.beginPath(); X.moveTo(-22, -30); X.lineTo(22, -30); X.lineTo(17, 6); X.lineTo(-17, 6); X.closePath(); ink('#4db8ff', 3.5);
  el(0, -30, 22, 7); ink('#a8e4ff', 3); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.arc(0, -30, 20, Math.PI, 0); X.stroke(); X.restore();
  X = old; return cv2;
}

/* cosmetic randomness (particles only): its own generator, so the seeded level never depends on effects */
let CS = 11; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;
/* window focus: a lost keyup / pointerup (Alt-Tab, app switch) must never leave the spray stuck on */
let FOCUSN = 0;
try { addEventListener('blur', () => FOCUSN++); document.addEventListener('visibilitychange', () => FOCUSN++); } catch (e) { /* headless */ }

/* ═════════ the game ═════════ */
function duHose(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), hose = D.role === 0, TS = Math.sqrt(sp);
  const NS = 6, NEED = NS - 1;                       // 6 blobs, one of them is the sleeping dog: clean the other 5
  const WET = 1.3, WEVERY = .45, SOAK = .45;          // a soak lasts WET s, refreshed at most every WEVERY s, after SOAK s of jet on it
  const KW = .0024 * TS, KD = KW * .012;             // mud per px of scrubbing: wet / dry
  const DRAIN = .6, FILL = .42, RESTART = .32;       // pressure: per s spraying / per s resting / needed after running dry
  const STUN = 1.05, IMMUNE = 2.2;
  /* the level: same on both screens (a 3×2 grid with jitter keeps the stains apart) */
  const cells = [[250, 300], [430, 290], [610, 305], [260, 450], [440, 460], [620, 445]];
  const st = cells.map(([cx, cy]) => {
    const x = cx + (R() - .5) * 90, y = cy + (R() - .5) * 56, r = 36 + R() * 12;
    const L = Array.from({ length: 11 }, () => .82 + R() * .34), L2 = Array.from({ length: 11 }, () => .8 + R() * .3);
    const sp2 = Array.from({ length: 4 }, () => [R() * TAU, 1.25 + R() * .4, 4 + R() * 5]);
    const cr2 = Array.from({ length: 3 }, () => { const a = R() * TAU; return [[a, .05 + R() * .15], [a + (R() - .5) * .8, .45 + R() * .2], [a + (R() - .5) * 1.2, .7 + R() * .15]]; });
    return { x, y, r, L, L2, sp: sp2, cr: cr2, hp: 1, wetUntil: -9, wetAt: -9, gone: false, goneAt: -9, soak: 0, sent: -9, askAt: -9 };
  });
  const dogI = Math.floor(R() * NS); st[dogI].dog = true;
  const variant = R() < 1 / 8;                       // 1 round in 8: a hot dog is watching from the stands
  /* state */
  let ax = 400, ay = 380, tx = 400, ty = 380, held = false, fN = FOCUSN, P = 1, dry = false, spraying = false, aimSent = -9, lastAim = '';
  let hx = 520, hy = 520, mtx = 520, mty = 520, bodyX = hx + BOFF[0], bodyY = hy + BOFF[1], sw = 0, dirt = 0, mash = 0, lastMash = '', mopSent = -9, lastMop = '', hpSent = -9, lastHp = '';
  let stunUntil = -9, immuneUntil = -9, slipAt = -9, cleaned = 0, ending = null, resAt = -1, dogAt = -9, dogDir = 1, growlAt = -9, dryAt = -9, lastCleanAt = -9;
  const kHeld = new Set(), aimX = track(), aimY = track(), mopX = track(), mopY = track();
  let jetOn = false, rmx = null, rmy = null, prevRmx = null;
  const bits = [], pops = [], paws = [];
  const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && m.color) || '#FFE14D'; } catch (e) { return '#FFE14D'; } };
  const pCol = () => (D.partner && D.partner.color) || '#6EA8FE';
  const HK = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (hose) Object.assign(HK, { KeyA: [-1, 0], KeyD: [1, 0] });
  const live = s => !s.gone && !(s.dog && dogAt > 0);
  const inStain = (s, x, y, pad) => { const rx = s.r * (.38 + .62 * s.hp) + pad, ry = rx * SQ; return ((x - s.x) / rx) ** 2 + ((y - s.y) / ry) ** 2 < 1; };
  function pop(s, x, y, size, bgc, fg) { pops.length = 0; pops.push({ s, x, y, size, bgc, fg, t0: g.c, rot: (cr() - .5) * .14 }); }
  function bit(o) { bits.push(Object.assign({ t0: g.c, life: .7, gr: 900, vr: 0, rot: 0, k: 0 }, o)); }
  function splash(x, y, n, col) { for (let i = 0; i < n; i++) bit({ x: x + (cr() - .5) * 30, y, vx: (cr() - .5) * 260, vy: -(140 + cr() * 220), r: 3 + cr() * 3, c: col || WATER }); }
  function wakeDog() {
    if (dogAt > 0) return; const s = st[dogI]; dogAt = g.c; dogDir = s.x < 400 ? -1 : 1;
    snd(520, .08, 'square', .06, 0, 300); snd(600, .1, 'square', .06, .14, 340); splash(s.x, s.y, 8, '#9a6a3a');
    pop('WOOF?!', s.x, s.y - 70, 30, '#ff9a4d', '#fff');
  }
  function cleanFx(s) {
    s.goneAt = g.c; lastCleanAt = g.c; sfx.coin(); sfx.sparkle(); ring(s.x, s.y, '#fff', 70, .35);
    for (let i = 0; i < 6; i++) bit({ k: 1, x: s.x + (cr() - .5) * 60, y: s.y + (cr() - .5) * 30, vx: (cr() - .5) * 120, vy: -(80 + cr() * 140), gr: 200, r: 10 + cr() * 6, life: .7 });
    pop(cleaned >= NEED ? 'SPOTLESS!' : ['SPARKLY!', 'SQUEAKY!', 'SHINY!', 'SPARKLY!'][cleaned % 4], s.x, s.y - 60, 30, '#4db8ff', '#fff');
  }
  function slipFx(x, y) { slipAt = g.c; sfx.boing(); sfx.splat(); shake(6, .2); splash(x, y - 40, 10); pop('SPLOOSH!', x, y - 110, 32, '#2b9ee6', '#fff'); }

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: hose ? 'SPRAY!' : 'SCRUB!', roleLabel: hose ? 'HOSE' : 'MOPPER',
    hint: hose ? 'AIM WITH THE MOUSE (OR ARROWS), HOLD CLICK / SPACE TO SPRAY THE MUD - NOT YOUR FRIEND!' : 'MOVE THE MOP (MOUSE OR ARROWS) ONTO WET MUD AND SCRUB BACK AND FORTH (OR MASH A / D) - DRY MUD WON\'T BUDGE',
    thint: hose ? 'DRAG TO AIM AND SPRAY THE MUD - NOT YOUR FRIEND!' : 'DRAG THE MOP BACK AND FORTH OVER WET MUD - DRY MUD WON\'T BUDGE',
    update(dt) {
      g.c += dt;
      if (g.result && resAt < 0) resAt = g.c;
      const done = !!(g.result || ending);
      if (FOCUSN !== fN || (typeof document !== 'undefined' && document.hidden)) { fN = FOCUSN; kHeld.clear(); held = false; }
      let kx = 0, ky = 0; for (const c of kHeld) if (HK[c]) { kx += HK[c][0]; ky += HK[c][1]; }
      if (hose) {
        // aim (pointer or arrows), pressure, spray
        if (kx || ky) { tx = clamp(tx + kx * 520 * dt, MINX, MAXX); ty = clamp(ty + ky * 420 * dt, MINY - 20, MAXY); }
        const k = Math.min(1, dt * 26); ax += (tx - ax) * k; ay += (ty - ay) * k;
        const want = (held || kHeld.has('Space') || kHeld.has('Enter')) && !done && g.c > .12;
        if (want && !dry) { P -= DRAIN * dt; if (P <= 0) { P = 0; dry = true; snd(200, .2, 'sawtooth', .05, 0, 90); } }
        else P = Math.min(1, P + FILL * dt);
        if (dry && P >= RESTART) dry = false;
        const was = spraying; spraying = want && !dry;
        if (spraying && !was) noise(.12, .05, 900, 3000, 'bandpass'); if (spraying && cr() < dt * 12) noise(.1, .022, 2600, 3400, 'bandpass');
        if (spraying) for (let i = 0; i < NS; i++) {
          const s = st[i]; if (!live(s) || !inStain(s, ax, ay, 24)) { s.soak = Math.max(0, s.soak - dt); continue; }
          s.soak += dt;
          if (s.soak >= SOAK && g.c - s.sent >= WEVERY) {
            s.sent = g.c; if (s.wetUntil < g.c) s.wetAt = g.c; s.wetUntil = g.c + WET; D.send('wet', i);
            if (s.dog) wakeDog();
          }
        }
        else for (const s of st) s.soak = Math.max(0, s.soak - dt);
        const a = Math.round(ax) + ',' + Math.round(ay) + ',' + (spraying ? 1 : 0);
        if (a !== lastAim && g.c - aimSent >= .1) { lastAim = a; aimSent = g.c; D.send('aim', [Math.round(ax), Math.round(ay), spraying ? 1 : 0], true); }
        // where my friend's mop is (interpolated), its strands swing with its speed
        const mx = mopX.at(), my = mopY.at();
        if (mx !== null) { prevRmx = rmx === null ? mx : rmx; rmx = mx; rmy = my; sw += (clamp((rmx - prevRmx) / Math.max(dt, 1e-3) / 900, -1, 1) - sw) * Math.min(1, dt * 12); }
      } else {
        // the mop: follows the pointer (or arrows); A / D mashing wiggles it in place
        const stun = g.c < stunUntil;
        if (!stun && !done) { if (kx || ky) { mtx = clamp(mtx + kx * 430 * dt, MINX, MAXX); mty = clamp(mty + ky * 360 * dt, MINY, MAXY); } }
        const ox = hx, oy = hy;
        if (!stun && !done) { const k = Math.min(1, dt * 30); hx += (mtx - hx) * k; hy += (mty - hy) * k; }
        let motion = Math.hypot(hx - ox, hy - oy);
        if (mash > 0 && !stun && !done) motion += mash * 62;
        motion = Math.min(motion, 1700 * dt);             // drag + mash share one cap: a key macro can't out-scrub a hand
        const vx = (hx - ox) / Math.max(dt, 1e-3) + (mash ? (lastMash === 'L' ? -900 : 900) : 0); mash = 0;
        sw += (clamp(vx / 900, -1, 1) - sw) * Math.min(1, dt * 14);
        bodyX += (hx + BOFF[0] - bodyX) * Math.min(1, dt * 10); bodyY += (hy + BOFF[1] - bodyY) * Math.min(1, dt * 10);
        // scrub the stain under the mop
        let under = -1, best = 1e9;
        for (let i = 0; i < NS; i++) { const s = st[i]; if (!live(s) || !inStain(s, hx, hy, 12)) continue; const d = Math.hypot(s.x - hx, s.y - hy); if (d < best) { best = d; under = i; } }
        if (under >= 0 && motion > 0 && !stun && !done) {
          const s = st[under], wet = s.wetUntil > g.c;
          if (s.dog) { if (g.c - growlAt > .9 && motion > 6) { growlAt = g.c; snd(90, .25, 'sawtooth', .05, 0, 70); pop('GRRR...', s.x, s.y - 60, 26, '#8a5a33', '#fff'); } }
          else {
            s.hp -= motion * (wet ? KW : KD); dirt = Math.min(1, dirt + motion * .0008);
            if (wet) { if (cr() < motion * .02) bit({ k: 2, x: hx + (cr() - .5) * 60, y: hy - 4, vx: (cr() - .5) * 60, vy: -(30 + cr() * 60), gr: -40, r: 5 + cr() * 7, life: .9 }); if (Math.sign(vx) !== Math.sign(s.lastV || 0) && Math.abs(vx) > 300) { snd(1300 + cr() * 500, .05, 'sine', .03, 0, 1900); } s.lastV = vx; }
            else if (motion > 4) { if (cr() < .2) noise(.05, .03, 500, 300, 'lowpass'); if (g.c - dryAt > .9) { dryAt = g.c; pop('TOO DRY!', s.x, s.y - 60, 26, '#a26a3a', '#fff'); snd(140, .08, 'square', .04, 0, 100); } if (g.c - s.askAt > .8) { s.askAt = g.c; D.send('ask', under); } }
            if (s.hp <= 0) { s.hp = 0; s.gone = true; cleaned++; D.send('gone', [under, cleaned]); cleanFx(s); }
          }
        }
        dirt = Math.max(0, dirt - dt * .25);
        // the jet as I see it (my friend's aim, ~LAG behind): it knocks me over if it hits my body
        const jx = aimX.at(), jy = aimY.at();
        if (jx !== null && jetOn && !done && !stun && g.c > immuneUntil) {
          const cx = hx + BOFF[0], cy = hy + BOFF[1] - 24;
          if (Math.hypot(jx - cx, (jy - cy) / .8) < BODYR) { stunUntil = g.c + STUN; immuneUntil = g.c + IMMUNE; D.send('slip', 1); slipFx(cx, cy + 24); }
        }
        const m = Math.round(hx) + ',' + Math.round(hy);
        if (m !== lastMop && g.c - mopSent >= .1) { lastMop = m; mopSent = g.c; D.send('mop', [Math.round(hx), Math.round(hy)], true); }
        const h = st.map(s => Math.round(s.hp * 100)).join();
        if (h !== lastHp && g.c - hpSent >= .14) { lastHp = h; hpSent = g.c; D.send('hp', st.map(s => Math.round(s.hp * 100)), true); }
        // the verdict (judge)
        if (!g.result) {
          if (!ending && cleaned >= NEED) ending = { res: 'win', at: g.c + .3 };
          if (ending && g.c >= Math.min(ending.at, g.limit)) g.finish(ending.res); else if (!ending && g.c >= g.limit) g.finish('lose');
        }
      }
      // cosmetic: particles, popped words, the dog's run
      for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.vy += b.gr * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt; if (g.c - b.t0 > b.life) bits.splice(i, 1); }
      if (pops.length && g.c - pops[0].t0 > 1) pops.length = 0;
      if (dogAt > 0) { const k = g.c - dogAt - .45; if (k > 0 && k < 1.3 && (paws.length === 0 || g.c - paws[paws.length - 1].t > .09)) { const p = dogPos(); paws.push({ x: p[0], y: p[1] + (paws.length % 2 ? 6 : -6), t: g.c }); } }
    },
    msg(type, d) {
      if (hose) {
        if (type === 'mop' && Array.isArray(d)) { mopX.push(d[0]); mopY.push(d[1]); }
        else if (type === 'hp' && Array.isArray(d)) d.forEach((v, i) => { if (st[i] && !st[i].gone) st[i].hp = clamp(v / 100, 0, 1); });
        else if (type === 'gone' && Array.isArray(d)) { const s = st[d[0]]; cleaned = Math.max(cleaned, d[1]); if (s && !s.gone) { s.gone = true; s.hp = 0; cleanFx(s); } }
        else if (type === 'slip') { const x = rmx === null ? 600 : rmx + BOFF[0], y = rmy === null ? 500 : rmy + BOFF[1]; slipFx(x, y); }
        else if (type === 'ask' && st[d]) { st[d].askAt = g.c; }
      } else {
        if (type === 'aim' && Array.isArray(d)) { aimX.push(d[0]); aimY.push(d[1]); jetOn = !!d[2]; }
        else if (type === 'wet' && st[d]) { const s = st[d]; if (s.gone) return; if (s.wetUntil < g.c) { s.wetAt = g.c; noise(.15, .05, 1800, 600, 'bandpass'); } s.wetUntil = g.c + WET; if (pops.length && pops[0].s === 'TOO DRY!') pops.length = 0; if (s.dog) wakeDog(); }
      }
    },
    draw() {
      const T = g.c, won = g.result === 'win' || (ending && ending.res === 'win'), lost = g.result === 'lose', rk = resAt >= 0 ? T - resAt : -1;
      X = ctx; if (!BG || BGV !== +variant) { BG = buildBg(variant); BGV = +variant; } X.drawImage(BG, 0, 0);
      // the banner + its rosettes (one per stain to clean)
      txt('BEST IN SHOW', 400, 96, 28, '#fff', 'center', 250);
      for (let i = 0; i < NEED; i++) {
        const x = 314 + i * 43, y = 124, on = i < cleaned, k = on ? outBack((T - (i === cleaned - 1 ? lastCleanAt : -9)) / .3) : 1;
        X.save(); X.translate(x, y); X.scale(k, k);
        if (on) { for (const sx of [-1, 1]) { X.beginPath(); X.moveTo(sx * 3, 6); X.lineTo(sx * 10, 22); X.lineTo(sx * 4, 18); X.lineTo(sx * 1, 24); X.closePath(); ink('#2b6fd6', 2); } star(0, 0, 15, 11, 12, 0, '#4db8ff', 2.5); X.beginPath(); X.arc(0, 0, 7, 0, TAU); ink(GOLD, 2); }
        else { el(0, 0, 13, 10); ink(MUD, 2.5); X.fillStyle = MUDL; el(-3, -3, 5, 3); X.fill(); }
        X.restore();
      }
      // the fans' eyes follow the water (or the mop when the hose rests); on a win they cheer, on a loss they gasp
      const look = hose ? (spraying ? [ax, ay] : [rmx || 500, rmy || 500]) : (jetOn ? [aimX.at() || 400, aimY.at() || 400] : [hx, hy]);
      for (const f of FANS) {
        const by = won ? -Math.abs(Math.sin(T * 10 + f.x)) * 5 : 0, dx = clamp((look[0] - f.x) / 300, -1, 1) * 2.4, dy = clamp((look[1] - f.y) / 300, -1, 1) * 2;
        for (const sx of [-1, 1]) { const ex = f.x + sx * f.gap / 2, ey = f.y + by; el(ex, ey, f.r * 1.5, f.r * 1.7); ink('#fff', 1.5); X.fillStyle = INK; if (f.slit) { el(ex + dx, ey + dy, 1.4, f.r * 1.2); } else el(ex + dx, ey + dy, lost ? 1.2 : f.r * .75, lost ? 1.2 : f.r * .85); X.fill(); }
      }
      // paw prints of the dog that ran off
      for (const p of paws) { X.globalAlpha = Math.max(0, 1 - (T - p.t) / 3) * .8; X.fillStyle = MUD; el(p.x, p.y, 6, 4); X.fill(); for (let i = -1; i <= 1; i++) { el(p.x + i * 5, p.y - 6, 2.2, 1.8); X.fill(); } X.globalAlpha = 1; }
      // stains (flat on the floor)
      for (let i = 0; i < NS; i++) {
        const s = st[i]; if (s.dog && dogAt > 0) continue;
        if (s.gone) { const a = T - s.goneAt; if (a < .5) { X.globalAlpha = 1 - a / .5; star(s.x, s.y, 40 * (1 + a), 12, 4, a * 3, '#fff', 0); X.globalAlpha = 1; } continue; }
        const left = s.wetUntil - T, w = left > 0 ? Math.min(1, (T - s.wetAt) / .15) * Math.min(1, left / .3) : 0;
        stain(s, T, w, s.hp, s.dog);
        if (left > 0 && !g.result) wetRing(s, left / WET, s.hp);
      }
      // "WET IT!" over the stain my friend is scrubbing dry (hose screen)
      if (hose && !g.result) for (const s of st) { const a = T - s.askAt; if (live(s) && a < .9 && s.wetUntil < T) bubble('WET IT!', s.x + 40, s.y - 20 - Math.sin(a * 8) * 2, 18, a < .15 ? outBack(a / .15) : 1); }
      // the dog that was a stain: wakes up, shakes, runs off
      if (dogAt > 0) {
        const a = T - dogAt, [dx, dy] = dogPos();
        if (a < 1.9) {
          const mood = a < .2 ? 'wake' : a < .45 ? 'shake' : 'run';
          if (mood === 'shake') for (let i = 0; i < 2; i++) { const an = cr() * TAU; drop(dx + Math.cos(an) * 40, dy - 40 + Math.sin(an) * 24, 3.5, '#9a6a3a'); }
          shadow(dx, dy + 2, 34, 8, .22);
          dogSprite(dx, dy, .9, dogDir, a * 22, mood, T);
        }
      }
      // the people: whoever is further back is drawn first
      const mx = hose ? rmx : hx, my = hose ? rmy : hy;
      const stunK = hose ? (T - slipAt < STUN ? 1 - Math.max(0, (T - slipAt) - (STUN - .25)) / .25 : 0) : (T < stunUntil ? 1 - Math.max(0, (T - (stunUntil - .25))) / .25 : 0);
      const fallK = stunK > 0 ? Math.min(1, (hose ? T - slipAt : T - (stunUntil - STUN)) / .12) * stunK : 0;
      const mcol = hose ? pCol() : myCol(), mmood = won ? 'happy' : lost ? 'sad' : null;
      const winJump = won ? Math.abs(Math.sin(T * 9)) * 14 : 0;
      const drawMopper = () => {
        if (mx === null) return;
        const bx = hose ? mx + BOFF[0] : bodyX, by = hose ? my + BOFF[1] : bodyY, under = st.find(s => live(s) && inStain(s, mx, my, 12));
        mopper(bx, by - winJump, mx, my, mcol, mmood, sw, dirt, fallK, T, !!under && under.wetUntil > T);
        pill(bx, by - 72 - winJump, hose ? 'YOUR FRIEND' : 'YOU', mcol);
      };
      // the win show: a trophy lands on the shiny floor, the judge holds up a 10; the loss: a white show poodle trots through the mud
      drawMopper();
      if (won && rk >= 0) {
        const k = clamp(rk / .32, 0, 1), y = lerp(-80, 410, k * k), bounce = rk > .32 ? Math.abs(Math.sin((rk - .32) * 12)) * 16 * Math.max(0, 1 - (rk - .32) * 2.5) : 0;
        shadow(400, 412, 50 * k, 12 * k, .25 * k);
        trophy(400, y - bounce, 1, T);
        if (rk > .32 && rk < .5) ring(400, 380, '#fff', 120, .25);
        const sweep = clamp((rk - .1) / .6, 0, 1);    // a shine sweeps the clean floor
        if (sweep > 0 && sweep < 1) { X.save(); X.globalAlpha = .45; X.fillStyle = '#fff'; const sx = -200 + sweep * 1300; X.beginPath(); X.moveTo(sx, FLOOR); X.lineTo(sx + 60, FLOOR); X.lineTo(sx - 100, H); X.lineTo(sx - 160, H); X.fill(); X.restore(); }
        const jk = clamp((rk - .35) / .25, 0, 1); judge(706, 620 - 150 * outBack(jk), 1, '10', T, false);
      }
      if (lost && rk >= 0) {
        const rest = st.filter(live), tgt = rest.length ? rest.reduce((a, b) => (b.x > a.x ? b : a)) : { x: 520, y: 420 };
        const k = clamp(rk / .55, 0, 1), px = lerp(880, tgt.x, ease(k)), py = lerp(tgt.y - 30, tgt.y + 6, k), mud = clamp((rk - .45) / .3, 0, 1);
        if (mud > 0 && mud < .3) splash(px, py - 10, 2, MUD);
        shadow(px, py + 2, 36, 8, .22); poodle(px, py, 1, mud, k < 1 ? rk * 24 : 0, mud > .4, T);
        if (rk > .7) badge('EWW!', px, py - 140, 30, '#8a5a33', '#fff', outBack((rk - .7) / .2), -.06);
        const jk = clamp((rk - .5) / .25, 0, 1); judge(262, 640 - 120 * outBack(jk), .8, '0', T, true);
      }
      // the hose holder (front left) and its jet
      const aim = hose ? [ax, ay] : [aimX.at() === null ? 400 : aimX.at(), aimY.at() === null ? 380 : aimY.at()];
      const on = hose ? spraying : jetOn && !g.result, dr = hose ? dry && (held || kHeld.has('Space') || kHeld.has('Enter')) : false;
      const hcol = hose ? myCol() : pCol();
      hoser(aim[0], aim[1], hcol, won ? 'happy' : lost ? 'sad' : null, on, T, on ? Math.sin(T * 40) * .5 + .5 : 0, won && rk > .1);
      pill(HX, HY - 74, hose ? 'YOU' : 'YOUR FRIEND', hcol);
      tank(hose ? P : 1, hose && dry, T);
      if (on && !won) jet(aim[0], aim[1], hose ? clamp(P * 2, .3, 1) : 1, false, T);
      else if (dr) jet(aim[0], aim[1], 0, true, T);
      // my aim reticle (hose)
      if (hose && !g.result) {
        const pulse = 1 + Math.sin(T * 8) * .06;
        X.save(); X.translate(ax, ay); X.scale(pulse, pulse);
        X.lineWidth = 8; X.strokeStyle = INK; X.beginPath(); X.ellipse(0, 0, 30, 30 * SQ, 0, 0, TAU); X.stroke();
        X.lineWidth = 4; X.strokeStyle = spraying ? '#fff' : '#ffd23f'; X.stroke();
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { line([[a * 22, b * 14], [a * 38, b * 24]], 8, INK); line([[a * 22, b * 14], [a * 38, b * 24]], 4, spraying ? '#fff' : '#ffd23f'); }
        X.restore();
        if (!spraying && T < 3 && !dry) badge(TOUCH ? 'HOLD TO SPRAY' : 'HOLD CLICK / SPACE', 200, 400, 18, '#2b9ee6', '#fff', 1, -.05);
        if (dry) badge('REFILLING...', 116, 318, 18, '#e8434f', '#fff', 1, -.05);
      }
      drawBits(T);
      for (const q of pops) { const a = T - q.t0; X.globalAlpha = a > .75 ? Math.max(0, 1 - (a - .75) / .25) : 1; badge(q.s, clamp(q.x - 60, 120, 660), Math.max(176, q.y - 40 - Math.min(a, .6) * 14), q.size, q.bgc, q.fg, a < .2 ? outBack(a / .2) : 1, q.rot); X.globalAlpha = 1; }
      if (!hose && !g.result && T < 3 && cleaned === 0) { const any = st.some(s => s.wetUntil > T); badge(any ? 'SCRUB THE WET ONE!' : 'WAIT FOR THE WATER', 400, 196, 18, any ? '#22a447' : '#7a5040', '#fff', 1, -.03); }
      vignette(.14);
    },
    down(p) { if (hose) { tx = clamp(p.x, MINX, MAXX); ty = clamp(p.y, MINY - 20, MAXY); held = true; } else g.move(p); },
    up() { if (hose) held = false; },
    move(p) { if (hose) { tx = clamp(p.x, MINX, MAXX); ty = clamp(p.y, MINY - 20, MAXY); } else { mtx = clamp(p.x, MINX, MAXX); mty = clamp(p.y, MINY, MAXY); } },
    key(e) {
      if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return;
      if (!hose && (e.code === 'KeyA' || e.code === 'KeyD' || e.code === 'KeyZ' || e.code === 'KeyX')) {   // mash: only a change of side counts
        if (e.repeat) return; const side = e.code === 'KeyA' || e.code === 'KeyZ' ? 'L' : 'R'; if (side !== lastMash) { lastMash = side; mash++; } return;
      }
      kHeld.add(e.code);
    },
    keyup(e) { kHeld.delete(e.code); },
  };
  function dogPos() {                                  // where the woken dog is now (same formula on both screens)
    const s = st[dogI], a = Math.max(0, g.c - dogAt - .45), k = a / 1.3;
    return [s.x + dogDir * k * 560, s.y + Math.sin(k * 5) * 10 + k * 30];
  }
  function drawBits(T) {                               // drops, sparkles, soap bubbles
    for (const b of bits) {
      const a = T - b.t0, fade = clamp(a > b.life * .6 ? 1 - (a - b.life * .6) / (b.life * .4) : 1, 0, 1);
      if (b.k === 1) { X.globalAlpha = fade; star(b.x, b.y, b.r, b.r * .35, 4, a * 4, '#fff', 2); X.globalAlpha = 1; }
      else if (b.k === 2) bubbleBall(b.x, b.y, b.r, fade);
      else { X.globalAlpha = fade; drop(b.x, b.y, b.r, b.c); X.globalAlpha = 1; }
    }
  }
  g.dbg = {
    st, NEED, dogI,
    /* what the HOSE screen shows: the stains (their mud as last reported), my aim + pressure, my friend's mop (interpolated) */
    hoseView: () => ({ stains: st.map((s, i) => ({ i, x: s.x, y: s.y, r: s.r, live: live(s), hp: s.hp, wet: Math.max(0, s.wetUntil - g.c) })), aim: [ax, ay], P, dry, spraying, mop: rmx === null ? null : [rmx, rmy] }),
    /* what the MOPPER screen shows: the stains (shine = wet), my mop, whether I'm knocked over, the jet */
    mopView: () => ({ stains: st.map((s, i) => ({ i, x: s.x, y: s.y, r: s.r, live: live(s), hp: s.hp, wet: Math.max(0, s.wetUntil - g.c) })), mop: [hx, hy], stun: g.c < stunUntil, jet: jetOn ? [aimX.at(), aimY.at()] : null }),
    cleaned: () => cleaned, BOFF, BODYR,
  };
  wire(g, D, 1, sp, 'du_hose');
  return g;
}
reg('du_hose', duHose, 'HOSE & MOP'); REGMAP.du_hose.duo = true;

/* ───────────── intro card: what each role does (520×240 frame), a 3.2 s loop: soak the stain, scrub it off ───────────── */
const DS = { x: 300, y: 150, r: 42, L: [1, .9, 1.08, .95, 1.1, .88, 1, 1.05, .92, 1.1, .97], L2: [.95, 1.05, .9, 1, 1.08, .92, 1, .96, 1.04, .9, 1], sp: [[.5, 1.3, 6], [2.2, 1.4, 5], [3.9, 1.35, 7], [5.3, 1.3, 4]], cr: [[[.3, .1], [.6, .5], [.2, .75]], [[2.4, .1], [2.1, .5], [2.7, .78]], [[4.4, .15], [4.8, .55], [4.2, .8]]] };
function demo(role, t) {
  X = ctx;
  let gr = X.createLinearGradient(0, 0, 0, 60); gr.addColorStop(0, '#3b2a6e'); gr.addColorStop(1, '#6a4bb8'); X.fillStyle = gr; X.fillRect(0, 0, 520, 60);
  gr = X.createLinearGradient(0, 60, 0, 240); gr.addColorStop(0, '#f3d9a9'); gr.addColorStop(1, '#fff3dc'); X.fillStyle = gr; X.fillRect(0, 60, 520, 180);
  X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 60); X.lineTo(520, 60); X.stroke();
  const u = t % 3.2, spray = u > .3 && u < 1.1, wetK = u > .45 ? Math.min(1, (u - .45) / .15) * (u < 3 ? 1 : 0) : 0, scrub = u > 1.2 && u < 2.5, hp = u < 1.2 ? 1 : u < 2.5 ? 1 - (u - 1.2) / 1.3 : 0;
  const mx = 300 + (scrub ? Math.sin(u * 22) * 40 : 0), my = 150;
  X.save();
  if (hp > 0) stain(DS, t, wetK, hp, false); else if (u < 2.9) { X.globalAlpha = 1 - (u - 2.5) / .4; star(DS.x, DS.y, 40, 12, 4, u * 3, '#fff', 0); X.globalAlpha = 1; }
  // the mopper waits beside the stain, then scrubs
  const hx = scrub ? mx : 392, hy = scrub ? my : 176;
  X.save(); X.translate(hx, hy); X.scale(.72, .72); X.translate(-hx, -hy);
  mopper(hx + BOFF[0], hy + BOFF[1], hx, hy, role ? '#FFC93C' : '#6EA8FE', hp <= 0 ? 'happy' : null, scrub ? Math.cos(u * 22) : 0, 0, 0, t, wetK > 0);
  X.restore();
  // the hose holder on the left
  X.save(); X.translate(64, 226); X.scale(.7, .7); X.translate(-HX, -HY);
  hoser(HX + (DS.x - 64) / .7, HY + (DS.y - 226) / .7, role ? '#6EA8FE' : '#FFC93C', null, spray, t, 0, false);
  X.restore();
  if (spray) {                                        // a short jet straight at the stain
    const nx = 64 + (NZ[0] - HX) * .7, ny = 226 + (NZ[1] - HY) * .7, C = [(nx + DS.x) / 2, Math.min(ny, DS.y) - 60], pts = [];
    for (let i = 0; i <= 16; i++) { const q = i / 16, a = (1 - q) * (1 - q), b = 2 * (1 - q) * q, c = q * q; pts.push([a * nx + b * C[0] + c * DS.x, a * ny + b * C[1] + c * DS.y]); }
    line(pts, 13, INK); line(pts, 7, WATER); line(pts, 2.5, FOAM); el(DS.x, DS.y, 26, 16); ink('rgba(170,232,255,.75)', 2);
  }
  if (role === 0) { demoFinger(DS.x + 14, DS.y + 26, spray, spray ? ((u - .3) * 1.5) % 1 : 0); badge(spray ? 'SPRAY!' : 'HOLD TO SPRAY', 160, 34, 18, '#2b9ee6', '#fff', 1, -.03); }
  else { demoFinger(scrub ? mx : 392, (scrub ? my : 176) + 26, scrub, 0); badge(scrub ? 'SCRUB!' : hp > 0 ? 'WAIT FOR THE WATER' : 'SPARKLY!', 370, 34, 18, scrub || hp <= 0 ? '#22a447' : '#7a5040', '#fff', 1, -.03); }
  X.restore();
}
DUO.INFO.du_hose = [['HOSE', 'WET THE MUD', 'AIM + HOLD TO SPRAY'], ['MOPPER', 'SCRUB THE WET MUD', 'DRAG BACK AND FORTH']];
DUO.DEMOS.du_hose = [t => demo(0, t), t => demo(1, t)];

})();
