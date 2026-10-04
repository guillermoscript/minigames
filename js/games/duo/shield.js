'use strict';
/* ═════════ DUO · BODYGUARD (du_shield), after Lovers in a Dangerous Spacetime ═════════
   PILOT (role 0, JUDGE): flies a heavy little saucer (Claude in the cockpit) to 5 stars that pop up one at a time, each on the side
   opposite the last one, so every trip crosses the cannons' fire. SHIELD (role 1): turns a 100° energy arc around that saucer.
   Three cannons on the edges charge up (glow + arrows) and fire orbs at the saucer; the shield bounces them back, and a bounced orb
   that hits a cannon knocks it out for a couple of seconds. 3 hits = the team loses; 5 stars before the time runs out = the team wins.
   Netcode (each side owns what it sees on its own screen):
   · 'sp' [x, y, clock ms, slip ms, best(shield-pilot) ms]  pilot -> shield, ~20 Hz, coalesced: the saucer (rendered through track())
     + the pilot's clock. 'ck' [shield clock ms, slip ms, best(pilot-shield) ms] (10 Hz) goes the other way; together they give the
     shield screen the judge's clock (NTP-style, min-delay samples over a sliding window, on hitch-free clocks), so a round that started
     a bit later on one phone still shows the same shots at the same time; the pilot also learns the round trip and waits that long.
   · 'sa' a*100   shield -> pilot, ~20 Hz, coalesced: the shield angle (kept unwrapped, so interpolation never spins the long way round).
   · the volley SCHEDULE (fire time + cannon of every shot) comes from the room seed. The AIM of each shot is picked on the shield screen
     LOCK s before it fires ('aim' {i, a}, or {i, s: 1} when that cannon is knocked out). From then on an orb's position is a pure
     function of (cannon, aim, fire time, clock), so both screens show the same shots. If that 'aim' has not reached the judge FB s
     after the fire time (partner asleep, gone, or a lag spike), the judge aims the shot itself and sends 'aimf' {i, a, o: late ms},
     which the shield screen adopts: a silent shield client can never leave the cannons quiet for a lone pilot.
   · blocks and knockouts are decided on the SHIELD screen ('blk' {i, x, y, d, tc}, 'ko' {c, x: already out}); blocks only count where
     the orb meets the arc (RS-18..RS+8, swept over the frame step so a slow frame cannot skip it), so a shield that just spins round
     and round lets most shots through.
   · hits are decided on the PILOT screen: an orb that reaches the hull there is held (sizzling) for max(GRACE, RTT/2 + .2) s; only if no 'blk' for it
     arrives in that window does it count ('hit' {i, n, p}). Stars are the pilot's too ('star' {k}). */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const wrapA = a => a - TAU * Math.floor((a + Math.PI) / TAU);
const rgb = h => { if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]; const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
const mix = (a, b, k) => { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const rgba = (h, a) => { const c = rgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

/* ───────────── layout (800×600; the HUD owns y<58, the top-left box x<320 & y<150, the top-right LEAVE and y>552) ───────────── */
const X0 = 76, X1 = 724, Y0 = 192, Y1 = 516;                 // where the saucer's centre can go
const CANS = [                                                // pivot, resting direction, max swing, strut length, where its "!" pops
  { x: 40, y: 410, rest: 0, sw: 1.42, st: 80, bx: 40, by: 352 },
  { x: 760, y: 296, rest: Math.PI, sw: 1.42, st: 80, bx: 760, by: 238 },
  { x: 652, y: 112, rest: Math.PI / 2, sw: 1.2, st: 52, bx: 706, by: 158, rock: 1 },   // hangs from a little asteroid
];
const BARREL = 50, RH = 30, RS = 72, HALF = 50 * DEG, ORB = 13, NEED = 5, LIVES = 3;
const LOCK = .36, TELE = .8, GRACE = .42, RING_WAIT = .4, KO_T = 2, INV = .35, FB = .15, CLK_WIN = 2.5;
const PAIR = .8, PGAP = .3, IV0 = .74, IV1 = .5, SPREAD = .12;     // pincer odds + gap, volley interval at the start / end, aim spread
const START = [400, 356];
const PANEL = { x: 322, y: 64, w: 286, h: 50 };
const heartX = i => PANEL.x + 214 + i * 25, starX = i => PANEL.x + 28 + i * 34;
const yMin = px => Y0 + 40 * clamp((362 - px) / 32, 0, 1);       // left of x≈330 the saucer stays lower, so its arc never slides under the HUD's player box
const AWAY = 150;                                                 // stars never spawn closer than this to a cannon pivot
const muzzle = (c, a) => [CANS[c].x + Math.cos(a) * BARREL, CANS[c].y + Math.sin(a) * BARREL];
const clampAim = (c, a) => CANS[c].rest + clamp(wrapA(a - CANS[c].rest), -CANS[c].sw, CANS[c].sw);
const oob = (x, y) => x < -40 || x > 840 || y < 30 || y > 640;

/* palette: a deep violet night with pink / teal nebulae; enemy fire is hot magenta, the reward is gold */
const INKC = INK, EO = '#ff3d6e', EO2 = '#a8124a', GOLD = '#FFD93D', GOLD2 = '#F29A1F', GOLDL = '#FFF6B8';
const MET = '#6c6893', MET2 = '#43405f', METL = '#a9a5cf', HUL = '#f4efe7', HUL2 = '#c9bfd8', GLASS = '#2a5a94';

/* ───────────── tiny cached art kit ───────────── */
const GL = {};
function glowSprite(col) {
  if (GL[col]) return GL[col];
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, rgba(col, .85)); gr.addColorStop(.3, rgba(col, .34)); gr.addColorStop(1, rgba(col, 0));
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return (GL[col] = c);
}
function glow(col, x, y, r, a = 1) {
  if (a <= 0) return; const ga = ctx.globalAlpha; ctx.save(); ctx.globalAlpha = Math.min(1, a) * ga; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2); ctx.restore();
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function starPath(c, cx, cy, ro, ri, n, rot) { c.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = rot + i * Math.PI / n; c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } c.closePath(); }
function heartPath(x, y, s) { ctx.beginPath(); ctx.moveTo(x, y + s * .95); ctx.bezierCurveTo(x - s * 1.5, y - s * .05, x - s * .75, y - s * 1.15, x, y - s * .42); ctx.bezierCurveTo(x + s * .75, y - s * 1.15, x + s * 1.5, y - s * .05, x, y + s * .95); ctx.closePath(); }
function inked(fill, lw) { ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = INKC; ctx.stroke(); ctx.fillStyle = fill; ctx.fill(); }
function twinkle(x, y, s, col = '#fff') { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s); ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.fill(); }

/* ───────────── the backdrop: baked once into an offscreen canvas ───────────── */
let BG = null;
function bakeBg() {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), r = mulberry32(90210);
  let gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0b0726'); gr.addColorStop(.42, '#1c0e46'); gr.addColorStop(.75, '#151a4c'); gr.addColorStop(1, '#0a1534');
  x.fillStyle = gr; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'lighter';
  const blob = (bx, by, rx, ry, rot, col, a) => {
    x.save(); x.translate(bx, by); x.rotate(rot); x.scale(1, ry / rx);
    const g2 = x.createRadialGradient(0, 0, 0, 0, 0, rx); g2.addColorStop(0, rgba(col, a)); g2.addColorStop(.45, rgba(col, a * .45)); g2.addColorStop(1, rgba(col, 0));
    x.fillStyle = g2; x.fillRect(-rx, -rx, rx * 2, rx * 2); x.restore();
  };
  blob(170, 230, 330, 210, .4, '#6d2cff', .42); blob(640, 170, 300, 150, -.3, '#ff2f8e', .26); blob(560, 470, 320, 170, .25, '#12b5d3', .26);
  blob(90, 540, 240, 120, -.2, '#ff6a3d', .16); blob(400, 330, 380, 120, -.35, '#5a2cff', .2); blob(300, 120, 200, 70, .1, '#ff4fd8', .14);
  blob(720, 400, 160, 90, .6, '#7c4dff', .22); blob(440, 520, 200, 60, 0, '#2de2e6', .1);
  for (let i = 0; i < 26; i++) blob(r() * W, r() * H, 30 + r() * 70, 10 + r() * 24, r() * 3, ['#ff4fa3', '#2de2e6', '#9b6bff'][i % 3], .06 + r() * .06);   // wisps
  // a faraway spiral galaxy
  x.save(); x.translate(470, 214); x.rotate(-.5); x.scale(1, .42);
  for (let k = 0; k < 2; k++) { x.strokeStyle = 'rgba(255,220,255,.12)'; x.lineWidth = 6; x.beginPath(); for (let a = 0; a < 5; a += .1) { const rr2 = 4 + a * 9; x.lineTo(Math.cos(a + k * Math.PI) * rr2, Math.sin(a + k * Math.PI) * rr2); } x.stroke(); }
  x.restore(); blob(470, 214, 26, 12, -.5, '#ffe0ff', .5);
  // far stars
  for (let i = 0; i < 300; i++) { const sx = r() * W, sy = r() * H, s = r(); x.fillStyle = `rgba(255,255,255,${.18 + s * .55})`; const z = s > .93 ? 2 : 1; x.fillRect(sx, sy, z, z); }
  for (let i = 0; i < 14; i++) { const sx = r() * W, sy = 60 + r() * 480; x.fillStyle = ['#bfe9ff', '#ffd6f0', '#fff6c2'][i % 3]; x.globalAlpha = .7; x.fillRect(sx - 4, sy - .5, 9, 1.5); x.fillRect(sx - .5, sy - 4, 1.5, 9); x.globalAlpha = 1; }
  x.globalCompositeOperation = 'source-over';
  // ringed planet (bottom right), cel-shaded with ink
  const px = 716, py = 600, pr = 118;
  const ringE = (front) => { x.save(); x.translate(px, py); x.rotate(-.26); x.beginPath(); x.ellipse(0, 0, 196, 36, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); x.lineWidth = 17; x.strokeStyle = INKC; x.stroke(); x.lineWidth = 9; x.strokeStyle = '#ffc98a'; x.stroke(); x.lineWidth = 3; x.strokeStyle = '#fff1d6'; x.stroke(); x.restore(); };
  ringE(false);
  x.save(); x.beginPath(); x.arc(px, py, pr, 0, TAU); x.clip();
  x.fillStyle = '#ff8a5c'; x.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  x.fillStyle = '#ffb27a'; for (const [dy, h] of [[-80, 14], [-44, 9], [-14, 18], [30, 10]]) { x.save(); x.translate(px, py + dy); x.rotate(-.26); x.fillRect(-pr * 1.4, -h / 2, pr * 2.8, h); x.restore(); }
  x.fillStyle = '#d9583f'; for (const [dy, h] of [[-62, 6], [6, 6]]) { x.save(); x.translate(px, py + dy); x.rotate(-.26); x.fillRect(-pr * 1.4, -h / 2, pr * 2.8, h); x.restore(); }
  x.fillStyle = 'rgba(70,18,70,.55)'; x.beginPath(); x.arc(px + 46, py + 30, pr * 1.02, 0, TAU); x.arc(px, py, pr + 2, 0, TAU, true); x.fill();
  x.fillStyle = 'rgba(70,18,70,.5)'; x.beginPath(); x.arc(px, py, pr + 2, 0, TAU); x.arc(px - 22, py - 18, pr * 1.02, 0, TAU, true); x.fill('evenodd');
  x.fillStyle = 'rgba(255,240,220,.55)'; x.beginPath(); x.ellipse(px - 62, py - 74, 22, 9, -.6, 0, TAU); x.fill();
  x.restore();
  x.beginPath(); x.arc(px, py, pr, 0, TAU); x.lineWidth = 5; x.strokeStyle = INKC; x.stroke();
  ringE(true);
  // little moon
  const mx = 236, my = 486, mr = 21; x.globalAlpha = .7;
  x.beginPath(); x.arc(mx, my, mr, 0, TAU); x.fillStyle = '#b9b2d9'; x.fill();
  x.save(); x.clip(); x.fillStyle = '#857db0'; x.beginPath(); x.arc(mx + 10, my + 9, mr, 0, TAU); x.fill(); x.fillStyle = '#d9d4f2'; x.beginPath(); x.ellipse(mx - 8, my - 9, 7, 4, -.6, 0, TAU); x.fill();
  x.fillStyle = 'rgba(70,60,110,.55)'; for (const [cx2, cy2, cr] of [[-6, 4, 4], [7, -6, 3], [3, 10, 2.5]]) { x.beginPath(); x.arc(mx + cx2, my + cy2, cr, 0, TAU); x.fill(); }
  x.restore(); x.beginPath(); x.arc(mx, my, mr, 0, TAU); x.lineWidth = 2; x.strokeStyle = 'rgba(20,16,28,.5)'; x.stroke();
  x.globalAlpha = 1;
  // arena: a faint energy fence with bright corner brackets
  x.save(); x.strokeStyle = 'rgba(120,225,255,.13)'; x.lineWidth = 2; x.setLineDash([10, 9]);
  x.beginPath(); x.moveTo(X0 - 26 + 18, Y0 - 30); x.arcTo(X1 + 26, Y0 - 30, X1 + 26, Y1 + 30, 18); x.arcTo(X1 + 26, Y1 + 30, X0 - 26, Y1 + 30, 18); x.arcTo(X0 - 26, Y1 + 30, X0 - 26, Y0 - 30, 18); x.arcTo(X0 - 26, Y0 - 30, X1 + 26, Y0 - 30, 18); x.closePath(); x.stroke();
  x.setLineDash([]); x.strokeStyle = 'rgba(140,235,255,.42)'; x.lineWidth = 4; x.lineCap = 'round';
  for (const [cx2, cy2, sx, sy] of [[X0 - 26, Y0 - 30, 1, 1], [X1 + 26, Y0 - 30, -1, 1], [X0 - 26, Y1 + 30, 1, -1], [X1 + 26, Y1 + 30, -1, -1]]) { x.beginPath(); x.moveTo(cx2, cy2 + sy * 30); x.lineTo(cx2, cy2); x.lineTo(cx2 + sx * 30, cy2); x.stroke(); }
  // centre emblem: a soft ring on the "floor" of the arena
  x.strokeStyle = 'rgba(160,140,255,.07)'; x.lineWidth = 3; x.beginPath(); x.arc(400, 350, 120, 0, TAU); x.stroke();
  x.restore();
  // vignette
  gr = x.createRadialGradient(400, 330, 230, 400, 330, 560); gr.addColorStop(0, 'rgba(6,3,20,0)'); gr.addColorStop(1, 'rgba(6,3,20,.62)'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
  return c;
}
/* the parallax layers: stars that drift and twinkle, a few lazy rocks */
const PAR = (() => { const r = mulberry32(4242), a = []; for (let i = 0; i < 62; i++) a.push({ x: r() * W, y: r() * H, z: i < 44 ? .35 : 1, s: r(), ph: r() * TAU }); return a; })();
const ROCKS = (() => { const r = mulberry32(777), a = []; for (let i = 0; i < 3; i++) { const pts = []; for (let k = 0; k < 7; k++) pts.push(.72 + r() * .38); a.push({ x: r() * W, y: 190 + r() * 320, s: 9 + r() * 9, v: 6 + r() * 6, rot: r() * 3, vr: (r() - .5) * .6, pts }); } return a; })();
function drawSky(camX, camY) {
  if (!BG) BG = bakeBg();
  ctx.drawImage(BG, 0, 0);
  for (const p of PAR) {
    const x = ((p.x - now * 7 * p.z - camX * p.z * .05) % W + W) % W, y = p.y - camY * p.z * .04, tw = .55 + .45 * Math.sin(now * (1.5 + p.s * 3) + p.ph);
    if (p.z < 1) { ctx.fillStyle = `rgba(210,220,255,${.35 + tw * .45})`; ctx.fillRect(x, y, 2, 2); }
    else { ctx.globalAlpha = .5 + tw * .5; twinkle(x, y, 2.5 + p.s * 3 * tw, p.s > .6 ? '#fff6c2' : '#d8f4ff'); ctx.globalAlpha = 1; }
  }
  for (const k of ROCKS) {
    const x = ((k.x - now * k.v - camX * .03) % (W + 80) + W + 80) % (W + 80) - 40, y = k.y + Math.sin(now * .7 + k.rot) * 6;
    ctx.save(); ctx.translate(x, y); ctx.rotate(k.rot + now * k.vr); ctx.globalAlpha = .85; ctx.beginPath();
    k.pts.forEach((m, i) => { const a = i / k.pts.length * TAU; ctx.lineTo(Math.cos(a) * k.s * m, Math.sin(a) * k.s * m); }); ctx.closePath();
    ctx.globalAlpha = .55; ctx.fillStyle = '#3b3463'; ctx.fill(); ctx.fillStyle = '#544b85'; ctx.beginPath(); ctx.arc(-k.s * .25, -k.s * .25, k.s * .45, 0, TAU); ctx.fill(); ctx.restore();
  }
  // a shooting star every few seconds
  const sh = (now % 5.3) / 5.3; if (sh < .12) { const k = sh / .12, sx = 820 - k * 520, sy = 70 + k * 120; ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 70, sy - 16); ctx.stroke(); ctx.lineCap = 'butt'; }
}

/* ───────────── the saucer ───────────── */
function flame(x, y, a, len, w = 8) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.beginPath(); ctx.moveTo(0, -w); ctx.quadraticCurveTo(len * .55, -w * .95, len, 0); ctx.quadraticCurveTo(len * .55, w * .95, 0, w); ctx.closePath(); inked('#ff8a3d', 4);
  ctx.beginPath(); ctx.moveTo(0, -w * .55); ctx.quadraticCurveTo(len * .4, -w * .5, len * .62, 0); ctx.quadraticCurveTo(len * .4, w * .5, 0, w * .55); ctx.closePath(); ctx.fillStyle = '#ffe14d'; ctx.fill();
  ctx.restore();
}
let DOME = null;   // the glass gradient, made once (it lives in the saucer's local space)
/* o: col (pilot colour), mood, tilt, sq (squash), vx, vy, spin, alpha, dmg (0..1 smoke/cracks) */
function drawShip(x, y, o) {
  const col = o.col || OR, bob = Math.sin(now * 3.1) * 2.5;
  ctx.save(); ctx.translate(x, y + bob); ctx.rotate((o.tilt || 0) + (o.spin || 0)); const sq = o.sq || 0, sc = o.s || 1.1; ctx.scale(sc * (1 + sq), sc * (1 - sq));
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  glow(col, 0, 20, 52, .5);
  // engines: a little idle jet underneath + a big one opposite to where it flies
  flame(0, 22, Math.PI / 2, 10 + Math.sin(now * 30) * 3, 6);
  const sp = Math.hypot(o.vx || 0, o.vy || 0);
  if (sp > 25) { const a = Math.atan2(-(o.vy || 0), -(o.vx || 0)) - (o.tilt || 0); flame(Math.cos(a) * 40, 6 + Math.sin(a) * 15, a, 14 + Math.min(1, sp / 190) * 24 + Math.random() * 7, 8); }
  // lower hull (skirt) in the pilot's colour
  ctx.beginPath(); ctx.ellipse(0, 9, 47, 18, 0, 0, TAU); inked(mix(col, '#2a1740', .18), 5);
  ctx.save(); ctx.clip(); ctx.fillStyle = mix(col, '#2a1740', .45); ctx.beginPath(); ctx.ellipse(6, 18, 50, 14, 0, 0, TAU); ctx.fill(); ctx.restore();
  for (let i = 0; i < 7; i++) {                                  // chasing rim lights
    const th = .2 + i / 6 * (Math.PI - .4), on = Math.floor(now * 9 - i) % 7 === 0;
    ctx.beginPath(); ctx.arc(Math.cos(th) * 36, 10 + Math.sin(th) * 12, 3.4, 0, TAU); ctx.fillStyle = on ? '#fff' : '#ffe9a0'; ctx.fill();
  }
  // deck
  ctx.beginPath(); ctx.ellipse(0, 2, 41, 12, 0, 0, TAU); inked(HUL, 4);
  ctx.save(); ctx.clip(); ctx.fillStyle = HUL2; ctx.beginPath(); ctx.ellipse(4, 10, 44, 9, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-16, -4, 14, 3, -.08, 0, TAU); ctx.fill(); ctx.restore();
  // glass dome with Claude inside
  ctx.save(); ctx.beginPath(); ctx.arc(0, -1, 28, Math.PI, 0); ctx.closePath(); ctx.clip();
  ctx.fillStyle = GLASS; ctx.fillRect(-29, -30, 58, 30);
  if (!DOME) { DOME = ctx.createRadialGradient(-6, -12, 2, 0, -4, 30); DOME.addColorStop(0, 'rgba(120,200,255,.55)'); DOME.addColorStop(1, 'rgba(120,200,255,0)'); }
  ctx.fillStyle = DOME; ctx.fillRect(-29, -30, 58, 30);
  claude(0, 7 + (o.mood === 'happy' ? -Math.abs(Math.sin(now * 12)) * 3 : 0), 2.75, { col, mood: o.mood });
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-13, -19, 8, 4, -.7, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(13, -12, 3, 2, -.9, 0, TAU); ctx.fill();
  if (o.dmg > 0) { ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(6, -24); ctx.lineTo(1, -15); ctx.lineTo(8, -10); ctx.lineTo(3, -2); ctx.moveTo(1, -15); ctx.lineTo(-7, -12); ctx.stroke(); }
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, -1, 28, Math.PI + .02, -.02); ctx.lineWidth = 5; ctx.strokeStyle = INKC; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
  // antenna
  ctx.strokeStyle = INKC; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(16, -24); ctx.quadraticCurveTo(22, -34, 20 + Math.sin(now * 5) * 2, -42); ctx.stroke();
  const bl = Math.sin(now * 6) > 0; ctx.beginPath(); ctx.arc(20 + Math.sin(now * 5) * 2, -44, 5, 0, TAU); inked(bl ? '#fff' : col, 3.5);
  ctx.restore();
}

/* ───────────── the shield arc ───────────── */
function drawShield(x, y, a, col, pulse, ghost) {
  const lite = mix(col, '#ffffff', .62);
  ctx.save(); ctx.lineCap = 'round';
  ctx.setLineDash([3, 11]); ctx.lineDashOffset = -now * 12; ctx.strokeStyle = rgba(col, ghost ? .2 : .32); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, RS, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  for (const k of [-.7, 0, .7]) glow(col, x + Math.cos(a + k * HALF) * RS, y + Math.sin(a + k * HALF) * RS, 38 + pulse * 26, .5 + pulse * .5);
  ctx.beginPath(); ctx.arc(x, y, RS + 7, a - HALF * .82, a + HALF * .82); ctx.strokeStyle = rgba(col, .28); ctx.lineWidth = 20 + pulse * 10; ctx.stroke();   // soft outer haze
  ctx.beginPath(); ctx.arc(x, y, RS, a - HALF, a + HALF);
  ctx.strokeStyle = INKC; ctx.lineWidth = 19 + pulse * 6; ctx.stroke();
  ctx.strokeStyle = pulse > .5 ? '#fff' : col; ctx.lineWidth = 11 + pulse * 4; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, RS - 2.5, a - HALF * .9, a + HALF * .9); ctx.strokeStyle = lite; ctx.lineWidth = 3; ctx.stroke();
  ctx.setLineDash([2, 13]); ctx.lineDashOffset = -now * 60; ctx.beginPath(); ctx.arc(x, y, RS + 2, a - HALF * .85, a + HALF * .85); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.setLineDash([]);
  // emitter on the hull pointing at the arc
  const ex = x + Math.cos(a) * 44, ey = y + Math.sin(a) * 26;
  ctx.beginPath(); ctx.arc(ex, ey, 6, 0, TAU); inked(col, 3.5); ctx.beginPath(); ctx.arc(ex - 1.5, ey - 1.5, 2, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.restore();
}
/* a little partner-coloured name tag ("FRIEND") */
function tag(x, y, label, col, below) {
  ctx.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif'; const w = Math.min(130, ctx.measureText(t(label)).width + 24), d = below ? -1 : 1;
  ctx.beginPath(); ctx.moveTo(x - 6, y + 13 * d); ctx.lineTo(x, y + 21 * d); ctx.lineTo(x + 6, y + 13 * d); ctx.closePath(); inked(col, 4);
  rr(x - w / 2, y - 13, w, 26, 13); inked(col, 4); ctx.save(); rr(x - w / 2, y - 13, w, 26, 13); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x - w / 2, y - 13, w, 8); ctx.restore();
  txt(label, x, y + 1, 15, INKC, 'center', w - 12);
}

/* ───────────── cosmetic particles (round sparks + twinkles, in the cel style; never part of the game state) ───────────── */
function spark(L, x, y, col, n, spd, kind = 0, life = .55) {
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = spd * (.7 + Math.random() * .6); L.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (.6 + Math.random() * .6), max: 0, r: kind ? 5 + Math.random() * 6 : 3 + Math.random() * 4, col, kind, rot: Math.random() * 3 }); L[L.length - 1].max = L[L.length - 1].life; }
  if (L.length > 260) L.splice(0, L.length - 260);
}
function drawSparks(L, dt) {
  for (let i = L.length - 1; i >= 0; i--) {
    const p = L[i]; p.life -= dt; if (p.life <= 0) { L.splice(i, 1); continue; }
    const dr = Math.max(0, 1 - dt * 1.6); p.vx *= dr; p.vy *= dr; p.x += p.vx * dt; p.y += p.vy * dt;
    const k = p.life / p.max, r = p.r * (.35 + .65 * k);
    if (p.kind) { ctx.globalAlpha = Math.min(1, k * 1.6); twinkle(p.x, p.y, r * 1.5, p.col); }
    else { ctx.globalAlpha = Math.min(1, k * 1.8); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x - r * .25, p.y - r * .25, r * .42, 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}
/* text pops: a new label of the same kind near a live one bumps it (scale kick + a "×2" badge) instead of stacking a second one */
function popText(L, kind, s, x, y, col, size, life = .85, rise = 34) {
  const o = L.find(p => p.kind === kind && now - p.t0 < p.life * .85 && Math.hypot(p.x - x, p.y - y) < 110);
  if (o) { o.bump = now; o.n++; o.t0 = Math.max(o.t0, now - .2); return; }
  const far = L.find(p => p.kind === kind && now - p.t0 < p.life); if (far && kind === 'ping') far.t0 = Math.min(far.t0, now - far.life * .8);   // a far PING fades out at once
  L.push({ kind, s, x, y, col, size, life, rise, t0: now, bump: -9, n: 1 });
}
/* nudge a w×h label off a list of boxes {x, y, w, h}: try the four sides of what it lands on and take the smallest move that stays on
   screen, clear of the others and (when home is given) clear of the saucer's shield ring */
function dodge(x, y, w, h, obs, home, minR = RS + 30) {
  const hit = (X, Y) => obs.find(o => Math.abs(X - o.x) < (w + o.w) / 2 && Math.abs(Y - o.y) < (h + o.h) / 2);
  const ok = (X, Y) => X >= 60 + w / 2 && X <= 740 - w / 2 && Y >= 176 && Y <= 530 && !hit(X, Y) && (!home || Math.hypot(X - home.x, Y - home.y) >= minR);
  let o = hit(x, y); if (!o) return [x, y];
  let best = null, bd = 1e9;
  for (let n = 0; n < 2 && o; n++) {
    for (const [cx, cy] of [[o.x - (w + o.w) / 2 - 6, y], [o.x + (w + o.w) / 2 + 6, y], [x, o.y - (h + o.h) / 2 - 6], [x, o.y + (h + o.h) / 2 + 6]]) {
      const d = Math.hypot(cx - x, cy - y); if (d < bd && ok(cx, cy)) { bd = d; best = [cx, cy]; }
    }
    if (best) return best;
    o = obs.find(q => q !== o && Math.abs(x - q.x) < (w + q.w) / 2 && Math.abs(y - q.y) < (h + q.h) / 2);
  }
  return [x, y];
}

function drawPops(L) {
  for (let i = L.length - 1; i >= 0; i--) {
    const p = L[i], age = now - p.t0; if (age > p.life) { L.splice(i, 1); continue; }
    const k = age / p.life, s = outBack(clamp(age / .16, 0, 1)) * (1 + .35 * clamp(1 - (now - p.bump) / .22, 0, 1)), al = clamp((1 - k) / .3, 0, 1);
    ctx.save(); ctx.globalAlpha = al; ctx.translate(p.x, p.y - ease(k) * p.rise); ctx.rotate(Math.sin(age * 9) * .05); ctx.scale(s, s);
    txt(p.s, 0, 0, p.size, p.col, 'center', 300);
    if (p.n > 1) { ctx.beginPath(); ctx.arc(p.size * 1.55, -p.size * .55, 15, 0, TAU); inked('#fff', 4); txt('×' + p.n, p.size * 1.55, -p.size * .55 + 1, 16, INKC, 'center', 26); }
    ctx.restore();
  }
}

/* ───────────── orbs ───────────── */
function drawOrb(x, y, a, friendly, col, k) {
  const c = friendly ? col : EO;
  for (let i = 4; i >= 1; i--) { ctx.globalAlpha = .16 * (5 - i); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x - Math.cos(a) * i * 10, y - Math.sin(a) * i * 10, ORB * (1 - i * .14), 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1; glow(c, x, y, 36 + (k || 0) * 10, friendly ? .55 : .9);
  if (friendly) { ctx.beginPath(); ctx.arc(x, y, ORB, 0, TAU); inked(c, 7); ctx.beginPath(); ctx.arc(x, y, ORB * .55, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); twinkle(x + 9, y - 9, 6); }
  else {
    starPath(ctx, x, y, ORB + 6, ORB - 1, 8, now * 7); inked(EO, 6);
    ctx.beginPath(); ctx.arc(x, y, ORB * .62, 0, TAU); ctx.fillStyle = '#ffd0dc'; ctx.fill(); ctx.beginPath(); ctx.arc(x - 2, y - 2, ORB * .32, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
  }
}

/* ───────────── cannons ───────────── */
/* st: { ang, charge 0..1, locked, ko 0..1 (time left), recoil 0..1, laugh } */
function drawCannon(C, st) {
  const ko = st.ko > 0, ch = ko ? 0 : st.charge;
  ctx.save(); ctx.translate(C.x, C.y);
  // strut back to the wall
  ctx.save(); ctx.rotate(C.rest); rr(-C.st, -13, C.st - 16, 26, 6); inked(MET2, 5); ctx.fillStyle = METL; ctx.fillRect(-C.st + 4, -9, C.st - 24, 4);
  ctx.fillStyle = INKC; for (const bx of [-C.st + 16, -C.st + 36]) { ctx.beginPath(); ctx.arc(bx, 4, 2.6, 0, TAU); ctx.fill(); } ctx.restore();
  if (C.rock) drawRock(-C.st * Math.cos(C.rest) * 1.08, -C.st * Math.sin(C.rest) * 1.08);
  if (ch > 0) glow(EO, 0, 0, 34 + ch * 52, .35 + ch * .65);
  // base plate (hexagon)
  starPath(ctx, 0, 0, 33, 33 * Math.cos(Math.PI / 6), 3, C.rest + Math.PI / 6); inked(MET2, 5);
  ctx.save(); ctx.clip(); ctx.fillStyle = '#5a5680'; ctx.fillRect(-40, -40, 80, 30); ctx.restore();
  for (const s2 of [-1, 1]) { const la = C.rest + Math.PI + s2 * .95, lx = Math.cos(la) * 25, ly = Math.sin(la) * 25, on = ko ? Math.floor(now * 3) % 2 : Math.floor(now * 2 + s2) % 2; ctx.beginPath(); ctx.arc(lx, ly, 4, 0, TAU); inked(ko ? '#555' : on ? '#ff6b9a' : '#7a2347', 2.5); }
  // barrel
  ctx.save(); ctx.rotate(st.ang); const back = st.recoil * 11;
  rr(4 - back, -12, BARREL + 2, 24, 7); inked('#4c4870', 5);
  ctx.fillStyle = '#6f6a98'; ctx.fillRect(8 - back, -9, BARREL - 8, 6);
  ctx.save(); rr(BARREL - 16 - back, -12, 18, 24, 5); ctx.clip(); ctx.fillStyle = ko ? '#6d6880' : '#ffd23f'; ctx.fillRect(BARREL - 18 - back, -14, 22, 28);
  ctx.fillStyle = INKC; for (let i = -2; i < 3; i++) { ctx.beginPath(); ctx.moveTo(BARREL - 16 - back + i * 9, 14); ctx.lineTo(BARREL - 10 - back + i * 9, 14); ctx.lineTo(BARREL - 2 - back + i * 9, -14); ctx.lineTo(BARREL - 8 - back + i * 9, -14); ctx.fill(); } ctx.restore();
  rr(BARREL - 16 - back, -12, 18, 24, 5); ctx.lineWidth = 4; ctx.strokeStyle = INKC; ctx.stroke();
  if (ch > 0) { ctx.beginPath(); ctx.arc(BARREL + 4 - back, 0, 4 + ch * 9, 0, TAU); ctx.fillStyle = ch > .85 && Math.floor(now * 20) % 2 ? '#fff' : '#ffb3c8'; ctx.fill(); }
  ctx.restore();
  // dome with one angry eye
  ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); inked(ko ? '#55516e' : MET, 5);
  ctx.save(); ctx.clip(); ctx.fillStyle = ko ? '#433f5a' : '#55507e'; ctx.beginPath(); ctx.arc(7, 8, 22, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(-8, -10, 8, 4, -.6, 0, TAU); ctx.fill(); ctx.restore();
  const ex = Math.cos(st.ang) * 3, ey = Math.sin(st.ang) * 3;
  if (ko) {
    ctx.strokeStyle = INKC; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(7, 7); ctx.moveTo(7, -7); ctx.lineTo(-7, 7); ctx.stroke(); ctx.lineCap = 'butt';
  } else if (st.laugh) {
    ctx.strokeStyle = INKC; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-8, 3); ctx.lineTo(0, -5); ctx.lineTo(8, 3); ctx.stroke(); ctx.lineCap = 'butt';
  } else {
    ctx.beginPath(); ctx.arc(ex * .4, ey * .4, 15, 0, TAU); ctx.fillStyle = ch > 0 ? mix('#3a1030', EO, ch * .8) : '#2a2440'; ctx.fill();
    ctx.beginPath(); ctx.arc(ex * .4, ey * .4, 15, 0, TAU); ctx.strokeStyle = ch > 0 ? EO : '#8a3a64'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(ex * .6, ey * .6, 11, 9, 0, 0, TAU); inked('#fff', 3.5);
    const pc = ch > 0 ? mix(EO, '#ffffff', ch > .85 && Math.floor(now * 20) % 2 ? .7 : 0) : EO2;
    ctx.beginPath(); ctx.arc(ex * 1.5, ey * 1.5, 5 + ch * 1.5, 0, TAU); ctx.fillStyle = pc; ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(ex * 1.5 - 2.5, ey * 1.5 - 3.5, 2.5, 2.5);
    // angry brow, lower when charging
    ctx.strokeStyle = INKC; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); const by = -10 + ch * 3; ctx.moveTo(-12, by - 4); ctx.lineTo(10, by + 2); ctx.stroke(); ctx.lineCap = 'butt';
  }
  ctx.restore();
  if (ko) {                                                         // dizzy stars
    for (let i = 0; i < 3; i++) { const a = now * 5 + i * TAU / 3; starPath(ctx, C.x + Math.cos(a) * 24, C.y - 30 + Math.sin(a) * 7, 7, 3, 5, now * 4); inked(GOLD, 3); }
  }
  if (ch > .05) {                                                   // "!" bubble
    const s = outBack(clamp(ch * 3, 0, 1)), wob = Math.sin(now * 30) * ch * 2;
    ctx.save(); ctx.translate(C.bx + wob, C.by); ctx.scale(s, s); ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); inked(st.locked ? '#fff' : EO, 4); txt('!', 0, 2, 22, st.locked ? EO : '#fff'); ctx.restore();
  }
}
/* the chunk of space rock the top cannon is bolted into (local space of the cannon pivot) */
const ROCKP = [[-38, 6], [-34, -12], [-18, -24], [2, -27], [22, -22], [37, -10], [40, 6], [28, 18], [8, 22], [-14, 21], [-30, 16]];
function drawRock(rx, ry) {
  ctx.save(); ctx.translate(rx, ry);
  const path = () => { ctx.beginPath(); ROCKP.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.closePath(); };
  path(); inked('#4f4778', 5);
  ctx.save(); path(); ctx.clip();
  ctx.fillStyle = '#383160'; ctx.beginPath(); ctx.ellipse(14, 22, 52, 22, -.15, 0, TAU); ctx.fill();          // shade
  ctx.fillStyle = '#7068a6'; ctx.beginPath(); ctx.ellipse(-12, -20, 26, 9, -.2, 0, TAU); ctx.fill();           // lit top
  for (const [cx, cy, cr] of [[-20, -2, 6], [16, -8, 4.5], [4, 9, 3.5]]) { ctx.fillStyle = '#2f2952'; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, TAU); ctx.fill(); ctx.fillStyle = '#7a72b0'; ctx.beginPath(); ctx.arc(cx + cr * .3, cy + cr * .35, cr * .55, 0, Math.PI); ctx.fill(); }
  ctx.restore();
  // the steel clamp where the strut goes in
  rr(-17, 12, 34, 13, 5); inked(MET2, 4); ctx.fillStyle = METL; ctx.fillRect(-12, 15, 24, 3);
  ctx.fillStyle = INKC; for (const bx of [-10, 10]) { ctx.beginPath(); ctx.arc(bx, 20.5, 2.4, 0, TAU); ctx.fill(); }
  ctx.restore();
}
/* aim telegraph: marching chevrons from the muzzle */
function drawTele(k, ang, ch, locked) {
  const [mx, my] = muzzle(k, ang), off = (now * 140) % 30, n = 7;
  ctx.save(); ctx.translate(mx, my); ctx.rotate(ang); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    const d = 22 + i * 30 + off, fade = (1 - i / n) * ch; if (fade <= .02) continue;
    ctx.globalAlpha = fade; ctx.beginPath(); ctx.moveTo(d - 8, -10); ctx.lineTo(d + 2, 0); ctx.lineTo(d - 8, 10);
    ctx.strokeStyle = INKC; ctx.lineWidth = 9; ctx.stroke(); ctx.strokeStyle = locked && Math.floor(now * 16) % 2 ? '#fff' : EO; ctx.lineWidth = 4.5; ctx.stroke();
  }
  ctx.restore(); ctx.globalAlpha = 1;
}

/* ───────────── collectible star ───────────── */
function drawGoal(x, y, pop, seed) {
  const s = outBack(pop), bob = Math.sin(now * 3 + seed) * 5; y += bob;
  glow(GOLD, x, y, 86, .55 + .15 * Math.sin(now * 4));
  ctx.save(); ctx.translate(x, y); ctx.rotate(now * .4);
  ctx.fillStyle = 'rgba(255,230,120,.16)'; for (let i = 0; i < 8; i++) { ctx.rotate(TAU / 8); ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(0, -64 * s); ctx.lineTo(6, 0); ctx.fill(); }
  ctx.restore();
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(Math.sin(now * 2.2 + seed) * .14);
  starPath(ctx, 0, 0, 33, 16, 5, -Math.PI / 2); inked(GOLD, 9);
  ctx.save(); ctx.clip(); ctx.fillStyle = GOLD2; ctx.beginPath(); ctx.moveTo(40, -40); ctx.lineTo(40, 40); ctx.lineTo(-40, 40); ctx.closePath(); ctx.globalAlpha = .55; ctx.translate(6, 10); ctx.fill(); ctx.globalAlpha = 1; ctx.restore();
  starPath(ctx, -3, -4, 15, 7, 5, -Math.PI / 2); ctx.fillStyle = GOLDL; ctx.globalAlpha = .55; ctx.fill(); ctx.globalAlpha = 1;
  const blink = Math.sin(now * 1.9 + seed) > .96 ? .2 : 1;
  ctx.fillStyle = INKC; for (const ex of [-7, 7]) { ctx.beginPath(); ctx.ellipse(ex, 0, 3, 5 * blink, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#fff'; for (const ex of [-8, 6]) ctx.fillRect(ex, -3, 2, 2);
  ctx.fillStyle = 'rgba(255,110,140,.6)'; for (const ex of [-13, 13]) { ctx.beginPath(); ctx.ellipse(ex, 7, 4, 2.5, 0, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = INKC; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 6, 4, .3, Math.PI - .3); ctx.stroke(); ctx.lineCap = 'butt';
  ctx.restore();
  for (let i = 0; i < 3; i++) { const a = now * 1.6 + i * TAU / 3 + seed, rr2 = 50 + Math.sin(now * 3 + i) * 6, tw = .5 + .5 * Math.sin(now * 7 + i * 2); twinkle(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2 * .8, (4 + tw * 5) * s, i ? '#fff' : GOLDL); }
}

/* ───────────── HUD panel: 5 star slots + 3 hull hearts ───────────── */
function drawPanel(got, gotT, hits, hitT, win) {
  const P = PANEL; ctx.save(); rr(P.x + 4, P.y + 5, P.w, P.h, 23); ctx.fillStyle = 'rgba(6,3,20,.55)'; ctx.fill();
  rr(P.x, P.y, P.w, P.h, 23); inked('#231a4d', 4); ctx.save(); ctx.clip(); ctx.fillStyle = '#2f2563'; ctx.fillRect(P.x, P.y, P.w, P.h * .45); ctx.restore();
  for (let i = 0; i < NEED; i++) {
    const x = starX(i), y = P.y + P.h / 2, on = i < got, k = on && i === got - 1 ? clamp((now - gotT) / .35, 0, 1) : 1, s = on ? (i === got - 1 ? .6 + outBack(k) * .4 : 1) : .9;
    const wv = win >= 0 ? Math.max(0, Math.sin(clamp(win * 5 - i * .55, 0, Math.PI))) : 0;
    ctx.save(); ctx.translate(x, y - wv * 12); ctx.scale(s * (1 + wv * .3), s * (1 + wv * .3)); ctx.rotate(wv * .5); starPath(ctx, 0, 0, 15, 7, 5, -Math.PI / 2);
    if (on) { inked(GOLD, 6); starPath(ctx, -1.5, -2, 7, 3.5, 5, -Math.PI / 2); ctx.fillStyle = GOLDL; ctx.fill(); }
    else { inked('#3d3470', 5); }
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(P.x + 191, P.y + 10, 3, P.h - 20);
  const HS = 10.5, danger = hits === LIVES - 1 && win < 0;
  for (let i = 0; i < LIVES; i++) {
    const x = heartX(i), y = P.y + P.h / 2 + 1, alive = i < LIVES - hits, age = now - hitT, fresh = !alive && i === LIVES - hits && age < .75;
    const beat = alive ? 1 + (danger ? .16 : .06) * Math.max(0, Math.sin(now * (danger ? 9 : 4) + i * .7)) : 1;
    ctx.save(); ctx.translate(x, y);
    if (alive) { ctx.scale(beat, beat); heartPath(0, 0, HS); inked('#ff4d6d', 4.5);
      ctx.save(); heartPath(0, 0, HS); ctx.clip(); ctx.fillStyle = '#c92a4f'; ctx.beginPath(); ctx.arc(7, 9, 12, 0, TAU); ctx.fill(); ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(-4.5, -4, 3.2, 2, -.6, 0, TAU); ctx.fill(); }
    else { heartPath(0, 0, HS); inked('#2c2557', 4); }
    if (fresh) {                                                     // the lost heart pops, flashes and breaks in two
      const k = age / .75, sx = Math.sin(now * 70) * 3 * (1 - k), pop = 1 + .6 * (1 - ease(Math.min(1, age / .25)));
      for (const sd of [-1, 1]) {
        ctx.save(); ctx.translate(sx + sd * ease(k) * 10, ease(k) * 16); ctx.rotate(sd * k * .7); ctx.scale(pop, pop); ctx.globalAlpha = 1 - ease(k);
        ctx.beginPath(); ctx.rect(sd < 0 ? -20 : 0, -20, 20, 40); ctx.clip(); heartPath(0, 0, HS); inked(age < .1 ? '#fff' : '#ff4d6d', 4.5);
        ctx.strokeStyle = INKC; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -HS * .45); ctx.lineTo(-3, -1); ctx.lineTo(3, 3); ctx.lineTo(0, HS * .9); ctx.stroke(); ctx.restore();
      }
    }
    ctx.restore();
  }
  ctx.restore();
}

/* ───────────── sounds ───────────── */
const S = {
  charge: () => snd(170, .36, 'sawtooth', .022, 0, 540),
  fire: () => { snd(760, .13, 'square', .04, 0, 170); noise(.12, .05, 2600, 400, 'bandpass'); },
  ping: () => { snd(1760, .22, 'triangle', .09); snd(2637, .16, 'sine', .05, .025); snd(3520, .08, 'sine', .03, .05); },
  ko: () => { sfx.thud(); snd(320, .4, 'sawtooth', .06, 0, 55); noise(.32, .08, 1600, 140, 'lowpass'); snd(1200, .1, 'square', .03, .18, 900); },
  hit: () => { sfx.thud(); snd(95, .42, 'sawtooth', .08, 0, 38); noise(.36, .1, 900, 90, 'lowpass'); },
  star: k => { const f = 784 * Math.pow(2, k * 2 / 12); snd(f, .08, 'square', .05); snd(f * 1.5, .22, 'triangle', .05, .07); noise(.15, .03, 5000, 9000, 'highpass', .02); },
  sizzle: () => noise(.18, .04, 3000, 6000, 'highpass'),
};

/* ═════════ the game ═════════ */
const KO_AT = [[128, 346], [672, 226], [552, 154]];     // where each cannon's "KO!" pops: beside its own cannon, toward the wall (clear of the HUD, the panel and the arena centre)
function duShield(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), pilot = D.role === 0, TS = Math.sqrt(sp);
  const V = 390 * TS, RV = 1.35 * V, VMAX = 205 * TS, RESP = 3.1, ROT = 6.4;
  /* the shared level: the volley schedule + the star spots (the same R() draws for both roles). Volleys come faster as the round goes
     on, and from ~2.6 s half of them are PINCERS: a second cannon on another wall fires .3 s after the first, so a shield that stays
     put (or just spins) can never cover both. */
  const shots = [];
  { let u = 1.15, last = -1, n = 0; while (u < 17.5) {
      const a = R(), two = R() < PAIR, b = R(), j1 = R(), j2 = R(), gap = R();
      let c1 = Math.floor(a * 3); if (c1 === last) c1 = (c1 + 1) % 3; const c2 = (c1 + 1 + Math.floor(b * 2)) % 3;
      shots.push({ i: n++, c: c1, t: u / TS, j: j1 });
      if (two && u > 2.6) shots.push({ i: n++, c: c2, t: (u + PGAP) / TS, j: j2 });
      last = c1; u += lerp(IV0, IV1, clamp((u - 2) / 10, 0, 1)) + gap * .22; } }
  shots.forEach(s => { s.a = null; s.st = 'wait'; s.toff = 0; s.cross = null; });
  const side0 = R() < .5 ? 0 : 1;
  const goals = Array.from({ length: NEED }, (_, k) => {
    const s = (side0 + k) % 2, gx = s ? 530 + R() * 130 : 140 + R() * 130, ry = R();
    let px = gx, py = k ? (s ? 214 + ry * 286 : 252 + ry * 248) : 262 + ry * 238;
    for (let n = 0; n < 2; n++) for (const C of CANS) {           // never under a cannon's nose: slide it out along the line from the pivot
      const dx = px - C.x, dy = py - C.y, l = Math.hypot(dx, dy) || 1;
      if (l < AWAY) { px = clamp(C.x + dx / l * AWAY, 130, 670); py = clamp(C.y + dy / l * AWAY, Math.max(214, yMin(px) + 30), 500); }
    }
    return { x: px, y: py };
  });
  const myCol = (() => { try { const m = typeof me === 'function' ? me() : null; if (m && m.color) return m.color; } catch (e) {} return pilot ? '#D97757' : '#6EA8FE'; })();
  const pCol = (D.partner && D.partner.color) || (pilot ? '#6EA8FE' : '#D97757');
  let shipCol = pilot ? myCol : pCol, shCol = pilot ? pCol : myCol;
  if (shipCol === shCol) { shipCol = '#D97757'; shCol = '#6EA8FE'; }   // a room never gives two players one colour; previews do
  /* state */
  let x = START[0], y = START[1], vx = 0, vy = 0, kx = 0, ky = 0, tgt = null, preTgt = null, drag = null;   // pilot (the shield screen renders it from sxT/syT)
  let sa = -Math.PI / 2, armed = false, armT = -9, kr = 0, ptr = null, lastSa = null, saSend = -1, spSend = -1, lastSp = '';
  let got = 0, gotT = -9, hits = 0, hitT = -9, inv = 0, pulse = 0, resNow = -1, resKind = null, sq = 0, flashT = -9;
  /* the shield screen runs its orbs on the JUDGE's clock (g.c + off): 'sp' carries the pilot clock and the pilot's max(shield - pilot)
     sample from 'ck', NTP-style, so a round that started a little later on one phone still shows the same shots at the same moment */
  /* each estimator keeps the best (min-delay) sample over the last CLK_WIN s only, so a frame hitch on either phone is forgotten */
  const winMax = () => { const q = []; return { push(v, t) { q.push([t, v]); while (q.length > 1 && q[0][0] < t - CLK_WIN) q.shift(); }, get() { let m = null; for (const e of q) if (m === null || e[1] > m) m = e[1]; return m; } }; };
  let off = 0, offW = null, ckSend = -1, cArem = null, grace = GRACE;
  /* main.js clamps dt to .05, so a frame hitch makes a phone's game clock fall behind real time: each side adds up that 'slip' and
     sends it along, and the samples above are taken on slip-free clocks, so the offset is right again on the very next message */
  let slip = 0, lastPT = null, pSlip = 0, lastOc = null, rt0 = null, realOK = null;
  const realT = () => typeof performance !== 'undefined' && performance.now ? performance.now() / 1000 : null;
  // a real browser can never run the game clock faster than real time; a headless sim can, and then the real clock is ignored
  const sfClock = () => { const pt = realT(); return g.c + slip + (realOK && pt !== null && lastPT !== null ? clamp(pt - lastPT, 0, 30) : 0); };   // my slip-free clock right now (a message can land after a stall, before the next update)
  const cA = winMax(), cB = winMax();
  const held = { L: 0, R: 0, U: 0, D: 0 };
  const sxT = track(), syT = track(), saTr = track(), ko = [-9, -9, -9], fireT = [-9, -9, -9], cAng = CANS.map(C => C.rest), rfs = [], flyers = [], puffs = [];
  const sparks = [], pops = [], dents = [], misses = [];
  let lastDraw = -1, lastPuff = 0;
  const oc = () => pilot ? g.c : g.c + off;
  const shipView = () => pilot ? { x, y } : { x: sxT.at(.1) === null ? START[0] : sxT.at(.1), y: syT.at(.1) === null ? START[1] : syT.at(.1) };
  const aimAt = (s, P, Vs, lead) => { const C = CANS[s.c], hit = predict(P, Vs, s.c, got, lead); return clampAim(s.c, Math.atan2(hit[1] - C.y, hit[0] - C.x) + (s.j - .5) * SPREAD); };
  const shipVel = () => { if (pilot) return { x: vx, y: vy }; const a = sxT.at(.1), b = sxT.at(.22), c = syT.at(.1), d = syT.at(.22); return a === null || b === null ? { x: 0, y: 0 } : { x: (a - b) / .12, y: (c - d) / .12 }; };
  const shieldView = () => pilot ? (saTr.at() === null ? -Math.PI / 2 : saTr.at()) : sa;
  const shieldOn = () => pilot ? saTr.at() !== null : armed;      // the shield powers up on its player's first move, so an idle partner never guards
  const orbAt = s => { const [mx, my] = muzzle(s.c, s.a), k = Math.max(0, oc() - s.t - s.toff) * V; return [mx + Math.cos(s.a) * k, my + Math.sin(s.a) * k]; };
  const covered = (ang, ox, oy, P, slack) => Math.abs(wrapA(Math.atan2(oy - P.y, ox - P.x) - ang)) <= HALF + slack;
  const goal = () => got < NEED ? goals[got] : null;
  /* the partner's piece wears a FRIEND tag: on the pilot screen it rides beside the shield arc, on the shield screen above the saucer (below it near the top) */
  let tagNow = null;
  const tagPos = (P, sy, A) => {
    let T;
    if (pilot) { if (!shieldOn()) return null; const ta = A + HALF + .5; T = { x: clamp(P.x + Math.cos(ta) * (RS + 18), 70, 730), y: clamp(sy + Math.sin(ta) * (RS + 12) - 6, 172, 530), below: Math.sin(ta) > .35 }; }
    else { const above = sy - 118 >= 172; T = { x: P.x, y: above ? sy - 118 : sy + 106, below: !above }; }
    const [dx, dy] = dodge(T.x, T.y, 116, 30, labelObs(), { x: P.x, y: sy }, 86); T.x = clamp(dx, 70, 730); T.y = dy; return T;
  };
  /* where to shoot: roll the saucer forward, homing on its star like a pilot does, until an orb fired now would meet it */
  function predict(P, Vs, c, gi, lead = .27 + LOCK) {
    let px = P.x, py = P.y, qx = Vs.x, qy = Vs.y, tt = 0, G = goals[gi] || null; const C = CANS[c], h = 1 / 30, lagK = lead;
    for (let i = 0; i < 90; i++) {
      const fl = Math.max(0, Math.hypot(px - C.x, py - C.y) - BARREL) / V;
      if (tt >= lagK + fl) break;
      if (G && Math.hypot(G.x - px, G.y - py) < 58) G = goals[++gi] || null;          // it grabs that star and turns for the next one
      if (G) { const dx = G.x - px, dy = G.y - py, l = Math.hypot(dx, dy) || 1, f = VMAX * Math.min(1, l / 70), k = Math.min(1, h * RESP); qx += (dx / l * f - qx) * k; qy += (dy / l * f - qy) * k; }
      px = clamp(px + qx * h, X0, X1); py = clamp(py + qy * h, yMin(px), Y1); tt += h;
    }
    return [px, py];
  }

  /* feedback */
  const LBOX = { ko: [112, 58], ouch: [140, 50], ping: [100, 40], miss: [160, 42] };
  const labelObs = (want = k => k === 'ko') => {        // the live labels (boxes cover their rise too) + the current star
    const o = pops.filter(p => now - p.t0 < p.life && want(p.kind.replace(/\d+$/, ''))).map(p => { const b = LBOX[p.kind.replace(/\d+$/, '')] || [100, 40]; return { x: p.x, y: p.y - p.rise * .45, w: b[0], h: b[1] + p.rise * .5 }; });
    const G = goal(); if (G && !g.result) o.push({ x: G.x, y: G.y, w: 84, h: 84 }); return o;
  };
  function pingFx(ox, oy, P) {
    pulse = 1; S.ping(); const d = Math.hypot(ox - P.x, oy - P.y) || 1, nx = (ox - P.x) / d, ny = (oy - P.y) / d;
    dents.push({ a: Math.atan2(ny, nx), t0: now });
    ring(ox, oy, '#fff', 64, .3); ring(ox, oy, shCol, 110, .45);
    spark(sparks, ox, oy, '#fff', 4, 420, 1, .35); spark(sparks, ox, oy, shCol, 7, 340, 0, .4);
    const obs = labelObs(k => k !== 'ping'); if (tagNow) obs.push({ x: tagNow.x, y: tagNow.y, w: 120, h: 34 });     // never on top of the FRIEND tag, a KO!, an OUCH! or the star
    const [lx, ly] = dodge(clamp(P.x + nx * (RS + 60), 76, 724), clamp(P.y + ny * (RS + 52), 182, 530), 96, 38, obs, P);
    popText(pops, 'ping', 'PING!', lx, ly, '#fff', 28);
  }
  function koFx(c) {
    const C = CANS[c], [lx, ly] = KO_AT[c];
    S.ko(); shake(7, .22); spark(sparks, C.x, C.y, GOLD, 8, 420, 1, .55); spark(sparks, C.x, C.y, EO, 8, 320, 0, .45);
    ring(C.x, C.y, '#fff', 110, .45); ring(C.x, C.y, GOLD, 70, .3);
    popText(pops, 'ko' + c, 'KO!', lx, ly, GOLD, 40, 1, 12);
  }
  function hitFx(P, a, real) {
    if (real) {
      S.hit(); shake(11, .32); hitT = now; flashT = now; sq = .35;
      { const hx = heartX(clamp(LIVES - hits, 0, LIVES - 1)), hy = PANEL.y + PANEL.h / 2; ring(hx, hy, '#ff4d6d', 62, .45); ring(hx, hy, '#fff', 36, .3); spark(sparks, hx, hy, '#ff4d6d', 6, 260, 0, .45); }
      spark(sparks, P.x, P.y, '#ff8a3d', 12, 420, 0, .5); spark(sparks, P.x, P.y, '#ffe14d', 6, 340, 1, .45); ring(P.x, P.y, EO, 120, .45);
      const [ox, oy] = dodge(clamp(P.x, 90, 710), Math.max(184, P.y - 76), 140, 46, labelObs(k => k !== 'ouch'));
      popText(pops, 'ouch', 'OUCH!', ox, oy, '#ff4d6d', 38);
    } else { S.sizzle(); spark(sparks, P.x + Math.cos(a + Math.PI) * 30, P.y + Math.sin(a + Math.PI) * 30, EO, 5, 160); }
  }
  function starFx(k, p) { S.star(k); if (k >= NEED) sfx.sparkle(); gotT = now + .5; spark(sparks, p.x, p.y, GOLD, 10, 420, 0, .5); spark(sparks, p.x, p.y, '#fff', 6, 360, 1, .5); ring(p.x, p.y, '#fff', 90, .4); ring(p.x, p.y, GOLD, 140, .55); flyers.push({ x: p.x, y: p.y, t0: now, k }); }

  /* the shield's block: bounce off the arc's normal, with a little magnetism toward a cannon so good blocks pay off */
  function block(s, ox, oy, P) {
    s.st = 'blk'; const d = Math.hypot(ox - P.x, oy - P.y) || 1, nx = (ox - P.x) / d, ny = (oy - P.y) / d, ux = Math.cos(s.a), uy = Math.sin(s.a), dot = ux * nx + uy * ny;
    let dir = Math.atan2(uy - 2 * dot * ny, ux - 2 * dot * nx), tc = -1, best = .55;
    CANS.forEach((C, k) => { const da = Math.abs(wrapA(Math.atan2(C.y - oy, C.x - ox) - dir)); if (da < best) { best = da; tc = k; } });
    if (tc >= 0) dir = Math.atan2(CANS[tc].y - oy, CANS[tc].x - ox);
    rfs.push({ x: ox, y: oy, d: dir, own: true, tc });
    D.send('blk', { i: s.i, x: Math.round(ox), y: Math.round(oy), d: Math.round(dir * 1000), tc });
    pingFx(ox, oy, P);
  }
  function resolveHit(s) {
    const P = { x, y }, real = inv <= 0 && !g.result; s.st = 'hit';
    if (real) { hits++; inv = INV; vx += Math.cos(s.a) * 250; vy += Math.sin(s.a) * 250; }
    hitFx(P, s.a, real); D.send('hit', { i: s.i, n: hits, p: real ? 1 : 0 });
  }

  /* the verdict, once, whoever set it (the judge in update, the partner from the 'end' message): a little show on top of duWin/duLose */
  function onResult() {
    if (!g.result || resNow >= 0) return; resNow = now; resKind = g.result; const P = shipView();
    if (resKind === 'win') {
      for (const s of shots) if (s.st === 'fly' || s.st === 'hold') { const [ox, oy] = s.st === 'hold' ? [P.x + s.hx, P.y + s.hy] : orbAt(s); s.st = 'gone'; spark(sparks, ox, oy, GOLD, 6, 220, 1); ring(ox, oy, GOLD, 40, .3); }
      for (const f of rfs) { spark(sparks, f.x, f.y, GOLD, 5, 200, 1); ring(f.x, f.y, '#fff', 36, .3); } rfs.length = 0;
      ring(P.x, P.y, GOLD, 160, .6); spark(sparks, P.x, P.y, GOLD, 16, 420, 1, .9); spark(sparks, P.x, P.y, '#fff', 12, 360); sfx.sparkle(); flyers.length = 0;
    } else {
      for (const s of shots) if (s.st === 'hold') s.st = 'gone';
      spark(sparks, P.x, P.y, '#ff8a3d', 18, 420); spark(sparks, P.x, P.y, '#ffe14d', 8, 320, 1); ring(P.x, P.y, EO, 150, .55); shake(12, .4);
      for (let i = 0; i < 10; i++) puffs.push({ x: P.x + (i - 5) * 8, y: P.y, vx: (i - 5) * 18, vy: -60 - (i % 3) * 30, r: 9 + (i % 4) * 3, life: 1.2, max: 1.2, col: '#5d5778' });
    }
  }
  const keyDir = c => c === 'ArrowLeft' || c === 'KeyA' ? 'L' : c === 'ArrowRight' || c === 'KeyD' ? 'R' : c === 'ArrowUp' || c === 'KeyW' ? 'U' : c === 'ArrowDown' || c === 'KeyS' ? 'D' : null;
  function keysChanged() {
    if (pilot) { kx = held.R - held.L; ky = held.D - held.U; if (kx || ky) tgt = null; }
    else { kr = held.R - held.L; if (kr) { ptr = null; if (!armed) armT = now; armed = true; } }
  }
  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: pilot ? 'FLY!' : 'GUARD!', roleLabel: pilot ? 'PILOT' : 'SHIELD',
    hint: pilot ? 'FLY TO THE STARS! (MOUSE / ARROWS)' : 'BLOCK THE SHOTS! (MOUSE / ◄ ►)',
    thint: pilot ? 'DRAG TO FLY TO THE STARS!' : 'TOUCH WHERE THE SHOTS COME FROM!',
    update(dt) {
      g.c += dt; inv = Math.max(0, inv - dt);
      { const pt = realT();
        if (pt !== null && rt0 === null) rt0 = pt - dt;
        if (pt !== null && realOK === null && g.c > .5) realOK = pt - rt0 >= g.c * .9;
        if (realOK && lastPT !== null && dt >= .0499) { const lost = pt - lastPT - dt; if (lost > .004 && lost < 30) { slip += lost; if (!pilot) off += lost; } }   // only frames main.js clamped lose time
        lastPT = pt; } pulse = Math.max(0, pulse - dt * 4); sq = Math.max(0, sq - dt * 2.2);
      onResult();
      const P = shipView();
      if (pilot) {
        /* heavy saucer: the velocity eases toward the wanted one */
        let wx = 0, wy = 0;
        if (!g.result) {
          if (kx || ky) { const l = Math.hypot(kx, ky); wx = kx / l * VMAX; wy = ky / l * VMAX; }
          else if (tgt) { const dx = tgt.x - x, dy = tgt.y - y, l = Math.hypot(dx, dy); if (l > 4) { const f = VMAX * Math.min(1, l / 70); wx = dx / l * f; wy = dy / l * f; } }
        }
        const k = Math.min(1, dt * RESP); vx += (wx - vx) * k; vy += (wy - vy) * k;
        x += vx * dt; y += vy * dt;
        if (x < X0) { x = X0; vx = Math.abs(vx) * .3; } else if (x > X1) { x = X1; vx = -Math.abs(vx) * .3; }
        const ym = yMin(x); if (y < ym) { y = Math.min(ym, y + Math.max(2, (ym - y) * Math.min(1, dt * 14))); vy = Math.max(vy, 0); } else if (y > Y1) { y = Y1; vy = -Math.abs(vy) * .3; }
        const key = Math.round(x) + ',' + Math.round(y);
        if ((key !== lastSp && g.c - spSend >= .05) || g.c - spSend >= .2) { lastSp = key; spSend = g.c; const m = [Math.round(x), Math.round(y), Math.round(g.c * 1000), Math.round(slip * 1000)], b = cB.get(); if (b !== null) m.push(Math.round(b * 1000)); D.send('sp', m, true); }
        /* orbs as the pilot sees them: held at the shield ring (if the partner's arc covers them) or at the hull, then resolved */
        const A = shieldView();
        for (const s of shots) {
          /* the shield screen picks each aim; if it never arrives (partner tab asleep, dropped, lag spike), the judge aims it itself and
             tells the shield, so a silent partner can never leave the cannons quiet */
          if (s.st === 'wait' && !g.result && g.c >= s.t + FB) {
            if (ko[s.c] > g.c) s.st = 'skip';
            else { s.a = aimAt(s, { x, y }, { x: vx, y: vy }, 0); s.toff = g.c - s.t; s.st = 'aim'; D.send('aimf', { i: s.i, a: Math.round(s.a * 1000), o: Math.round(s.toff * 1000) }); S.charge(); }
          }
          if (s.st === 'aim' && !g.result && g.c >= s.t) { s.st = 'fly'; fireT[s.c] = g.c; S.fire(); const [mx, my] = muzzle(s.c, s.a); ring(mx, my, EO, 50, .25); spark(sparks, mx, my, '#ffb3c8', 5, 200); }
          if (s.st === 'fly') {
            const [ox, oy] = orbAt(s), d = Math.hypot(ox - x, oy - y);
            if (oob(ox, oy)) s.st = 'gone';
            else if (!g.result && !s.pred && shieldOn() && d <= RS && d > RH + 8 && covered(A, ox, oy, P, .05)) { s.st = 'hold'; s.ring = true; s.pred = true; s.ht = g.c; s.hx = ox - x; s.hy = oy - y; S.sizzle(); }
            else if (!g.result && d <= RH + ORB + 2) { s.st = 'hold'; s.ring = false; s.ht = g.c; s.hx = ox - x; s.hy = oy - y; }
          } else if (s.st === 'hold') {
            if (g.result) s.st = 'gone';
            else if (s.ring && g.c - s.ht > RING_WAIT) { s.st = 'fly'; s.toff += g.c - s.ht; }     // the partner's shield was not there after all: let it through
            else if (!s.ring && g.c - s.ht > grace) resolveHit(s);
          }
        }
        /* stars */
        const G = goal();
        if (!g.result && G && Math.hypot(G.x - x, G.y - y) < 58) { got++; D.send('star', { k: got }); starFx(got, G); if (got >= NEED) g.finish('win'); }
        if (!g.result) { if (hits >= LIVES) g.finish('lose'); else if (g.c >= g.limit) g.finish('lose'); }
      } else {
        /* the judge's clock: snap to it before the first shot, then only drift gently so flying orbs never jump */
        if (g.c - ckSend >= .1) { ckSend = g.c; const a = cA.get(), m = [Math.round(g.c * 1000), Math.round(slip * 1000)]; if (a !== null) m.push(Math.round(a * 1000)); D.send('ck', m, true); }
        if (offW !== null) { const want = offW - pSlip + slip; if (!shots.some(s => s.st !== 'wait')) off = want; else off += clamp(want - off, -.5 * dt, .5 * dt); }
        /* the shield: follow the pointer (relative to the saucer as this screen shows it) or turn with the keys */
        if (!g.result) {
          if (kr) sa += kr * ROT * dt;
          else if (ptr) { const want = Math.atan2(ptr.y - P.y, ptr.x - P.x); sa += wrapA(want - sa) * Math.min(1, dt * 28); }
        }
        const r = Math.round(sa * 100); if (armed && r !== lastSa && g.c - saSend >= .05) { lastSa = r; saSend = g.c; D.send('sa', r, true); }
        const Vs = shipVel(), T = oc(), step = lastOc === null ? 0 : Math.max(0, T - lastOc); lastOc = T;
        for (const s of shots) {
          if (s.st === 'wait' && !g.result && T >= s.t - LOCK) {
            if (ko[s.c] > T) { s.st = 'skip'; D.send('aim', { i: s.i, s: 1 }); }
            else { s.a = aimAt(s, P, Vs); s.st = 'aim'; D.send('aim', { i: s.i, a: Math.round(s.a * 1000) }); S.charge(); }
          }
          if (s.st === 'aim' && !g.result && T >= s.t + s.toff) { s.st = 'fly'; fireT[s.c] = T; S.fire(); const [mx, my] = muzzle(s.c, s.a); ring(mx, my, EO, 50, .25); spark(sparks, mx, my, '#ffb3c8', 5, 200); }
          if (s.st === 'fly') {
            const [ox, oy] = orbAt(s), rx = ox - P.x, ry = oy - P.y, d = Math.hypot(rx, ry);
            /* swept test: on a slow frame the orb can jump right over the arc's band, so check the step from the last frame too */
            const pd = s.pd === undefined ? d : s.pd, prx = s.pd === undefined ? rx : s.prx, pry = s.pd === undefined ? ry : s.pry; s.pd = d; s.prx = rx; s.pry = ry;
            let bx = ox, by = oy, late = 0; if (d < RS - 18 && pd > d) { const k = clamp((pd - RS) / (pd - d), 0, 1); bx = P.x + lerp(prx, rx, k); by = P.y + lerp(pry, ry, k); late = (1 - k) * step; }
            if (oob(ox, oy)) s.st = 'gone';
            else if (!g.result && armed && late < .1 && d <= pd && d <= RS + 8 && pd >= RS - 18 && covered(sa, bx, by, P, .2)) block(s, bx, by, P);   // a crossing that happened during a long stall is too old to block
            else {
              if (d <= RS && s.cross === null) s.cross = Math.atan2(oy - P.y, ox - P.x);       // where it slipped through on this screen
              if (d < RH - 4) { s.st = 'gone'; s.passT = g.c; }
            }
          }
        }
      }
      /* bounced orbs: on the shield screen they knock cannons out; on the pilot screen they are a picture of the partner's 'blk' */
      for (let i = rfs.length - 1; i >= 0; i--) {
        const f = rfs[i]; f.x += Math.cos(f.d) * RV * dt; f.y += Math.sin(f.d) * RV * dt;
        let gone = oob(f.x, f.y);
        for (let k = 0; k < 3 && !gone; k++) if (Math.hypot(f.x - CANS[k].x, f.y - CANS[k].y) < 36) {
          gone = true;
          if (f.own && !g.result) { const was = ko[k] > oc(); if (!was) ko[k] = oc() + KO_T; D.send('ko', { c: k, x: was ? 1 : 0 }); if (was) spark(sparks, f.x, f.y, GOLD, 6, 260, 1, .4); else koFx(k); }   // a cannon that is already out is not kept out longer
          else if (!f.own) spark(sparks, f.x, f.y, shCol, 6, 200);
        }
        if (gone) rfs.splice(i, 1);
      }
    },
    msg(t, d) {
      if (pilot) {
        if (t === 'sa') saTr.push(d / 100);
        else if (t === 'ck') {
          const a = Array.isArray(d) ? d : [d, 0]; cB.push((a[0] + a[1]) / 1000 - sfClock(), g.c); if (a.length > 2) cArem = a[2] / 1000;
          const b = cB.get(); if (cArem !== null && b !== null) grace = clamp(-(cArem + b) / 2 + .2, GRACE, .8);   // min RTT/2 + margin: how long a 'blk' may take to arrive
        }
        else if (t === 'aim') { const s = shots[d.i]; if (!s || s.st !== 'wait' || g.result) return; if (d.s) s.st = 'skip'; else { s.a = d.a / 1000; s.st = 'aim'; S.charge(); } }
        else if (t === 'blk') {
          const s = shots[d.i]; if (!s || s.st === 'hit' || s.st === 'blk' || g.result) return;
          let ox = d.x, oy = d.y;
          if (s.st === 'hold') { ox = x + s.hx; oy = y + s.hy; } else if (s.st === 'fly' && s.a !== null) { const p = orbAt(s); if (Math.hypot(p[0] - x, p[1] - y) < 160) { ox = p[0]; oy = p[1]; } }
          s.st = 'blk'; const dir = d.tc >= 0 ? Math.atan2(CANS[d.tc].y - oy, CANS[d.tc].x - ox) : d.d / 1000;
          rfs.push({ x: ox, y: oy, d: dir, own: false, tc: d.tc }); pingFx(ox, oy, { x, y });
        }
        else if (t === 'ko') { if (!d.x) ko[d.c] = g.c + KO_T - .1; const f = rfs.findIndex(q => q.tc === d.c); if (f >= 0) rfs.splice(f, 1); if (d.x) spark(sparks, CANS[d.c].x, CANS[d.c].y, GOLD, 6, 260, 1, .4); else koFx(d.c); }
      } else {
        if (t === 'sp') {
          sxT.push(d[0]); syT.push(d[1]);
          if (d.length > 3) { pSlip = d[3] / 1000; cA.push((d[2] + d[3]) / 1000 - sfClock(), g.c); if (d.length > 4) offW = clamp((cA.get() - d[4] / 1000) / 2, -1.5, 1.5); }
        }
        else if (t === 'aimf') {   // the judge aimed this one itself (our 'aim' never reached it in time): its version is the real one
          const s = shots[d.i]; if (!s || s.st === 'blk' || s.st === 'gone' || s.st === 'hit' || g.result) return;
          s.a = d.a / 1000; s.toff = d.o / 1000; if (s.st !== 'fly') s.st = 'aim'; s.pd = undefined;
        }
        else if (t === 'hit') {
          const s = shots[d.i]; if (s) { if (d.p && s.cross !== null) misses.push({ a: s.cross, t0: now }); s.st = 'hit'; }
          hits = d.n; if (d.p) inv = INV; hitFx(shipView(), s && s.a !== null ? s.a : 0, !!d.p);
        }
        else if (t === 'star') { const G = goals[d.k - 1]; got = d.k; if (G) starFx(d.k, G); }
      }
    },
    draw() {
      onResult();
      const dtD = lastDraw < 0 ? 0 : clamp(now - lastDraw, 0, .05), dtP = lastDraw < 0 ? 0 : clamp(now - lastDraw, 0, .5); lastDraw = now;   // dtP: cosmetic particles age in real time
      const P = shipView(), Vv = shipVel(), A = shieldView(), rt = resNow < 0 ? -1 : now - resNow, T = oc();
      drawSky(P.x - 400, P.y - 350);
      /* the next star (+ a guide for the pilot at the start) */
      const G = goal();
      if (G && !(resKind === 'lose')) {
        if (pilot && g.c < 2.6 && !g.result) {
          const dx = G.x - P.x, dy = G.y - P.y, l = Math.hypot(dx, dy), al = clamp(1 - (g.c - 1.8) / .8, 0, 1);
          if (l > 120) { ctx.save(); ctx.globalAlpha = al; ctx.setLineDash([2, 16]); ctx.lineDashOffset = -now * 50; ctx.lineCap = 'round'; ctx.strokeStyle = GOLD; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(P.x + dx / l * 60, P.y + dy / l * 60); ctx.lineTo(G.x - dx / l * 60, G.y - dy / l * 60); ctx.stroke(); ctx.restore(); }
        }
        drawGoal(G.x, G.y, clamp((now - (got ? gotT : -1)) / .45, 0, 1), got * 1.7);
      }
      /* cannons + telegraphs */
      for (let k = 0; k < 3; k++) {
        let up = null; for (const s of shots) if (s.c === k && (s.st === 'wait' || s.st === 'aim') && s.t - T < TELE && s.t >= T) { if (!up || s.t < up.t) up = s; }
        const kod = ko[k] > T, C = CANS[k];
        let want = clampAim(k, Math.atan2(P.y - C.y, P.x - C.x)); if (up && up.a !== null) want = up.a;
        if (kod) want = C.rest + Math.sin(now * 3 + k) * .5 + .4;
        if (resKind === 'win') want = C.rest + Math.sin(now * 4 + k) * .9;
        cAng[k] += wrapA(want - cAng[k]) * Math.min(1, dtD * (up && up.a !== null ? 22 : 7));
        const ch = up && !kod && !g.result ? clamp(1 - (up.t - T) / TELE, 0, 1) : 0;   // the pilot sees the charge from the shared schedule; the arrows lock when the aim arrives
        if (ch > 0) drawTele(k, cAng[k], ch, up.a !== null);
        drawCannon(C, { ang: cAng[k], charge: ch, locked: up && up.a !== null, ko: kod || resKind === 'win' ? 1 : 0, recoil: clamp(1 - (T - fireT[k]) / .28, 0, 1), laugh: resKind === 'lose' });
        if (kod && Math.random() < dtD * 10) puffs.push({ x: C.x + (Math.random() - .5) * 20, y: C.y - 10, vx: (Math.random() - .5) * 20, vy: -40, r: 6 + Math.random() * 5, life: .9, max: .9, col: '#8a84a8' });
      }
      /* cosmetic puffs (engine exhaust, smoke) */
      const spd = Math.hypot(Vv.x, Vv.y);
      if (spd > 40 && now - lastPuff > .05 && resKind !== 'lose') { lastPuff = now; const a = Math.atan2(-Vv.y, -Vv.x); puffs.push({ x: P.x + Math.cos(a) * 52, y: P.y + 8 + Math.sin(a) * 18, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, r: 4 + Math.random() * 3, life: .45, max: .45, col: '#ffd27a' }); }
      if ((hits >= 2 || resKind === 'lose') && Math.random() < dtD * (resKind === 'lose' ? 30 : 8)) puffs.push({ x: P.x + (Math.random() - .5) * 40, y: P.y - 4, vx: (Math.random() - .5) * 30, vy: -50, r: 7 + Math.random() * 6, life: 1, max: 1, col: '#5d5778' });
      for (let i = puffs.length - 1; i >= 0; i--) { const p = puffs[i]; p.life -= dtP; if (p.life <= 0) { puffs.splice(i, 1); continue; } p.x += p.vx * dtP; p.y += p.vy * dtP; const k = p.life / p.max; ctx.globalAlpha = k * .8; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.6 - k * .6), 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      /* enemy orbs */
      for (const s of shots) {
        if (s.a === null) continue;
        if (s.st === 'fly') { const [ox, oy] = orbAt(s); drawOrb(ox, oy, s.a, false, EO, 0); }
        else if (s.st === 'hold') {
          const hl = Math.hypot(s.hx, s.hy) || 1, rad = s.ring ? RS - 2 : RH + 8, ox = P.x + s.hx / hl * rad, oy = P.y + s.hy / hl * rad;
          drawOrb(ox + (Math.random() - .5) * 4, oy + (Math.random() - .5) * 4, s.a, false, EO, 1);
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); for (let i = 0; i < 2; i++) { const a = Math.random() * TAU; ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(a) * 18, oy + Math.sin(a) * 18); ctx.lineTo(ox + Math.cos(a + .5) * 26, oy + Math.sin(a + .5) * 26); } ctx.stroke();
        }
      }
      /* the saucer + its shield */
      const hitK = clamp((now - flashT) / .5, 0, 1), blinkOff = inv > 0 && !g.result && Math.floor(now * 16) % 2 === 0;
      let spin = 0, tilt = clamp(Vv.x / 600, -.3, .3), shipY = P.y, sqz = sq * Math.sin((now - flashT) * 30) * (1 - hitK);
      if (resKind === 'win') { spin = TAU * ease(rt / .8); shipY -= Math.sin(clamp(rt / .8, 0, 1) * Math.PI) * 40; sqz = rt < 1 ? Math.sin(rt * 18) * .12 * (1 - rt) : 0; }
      if (resKind === 'lose') { spin = Math.sin(rt * 9) * .5 * Math.max(0, 1 - rt * .4); shipY += Math.min(30, rt * 30); }
      const mood = resKind === 'win' ? 'happy' : resKind === 'lose' || hitK < 1 ? 'sad' : null;
      /* a missed side flashes red on the shield player's ring, so they learn where they left a gap */
      for (let i = misses.length - 1; i >= 0; i--) {
        const m = misses[i], k = (now - m.t0) / .9; if (k >= 1) { misses.splice(i, 1); continue; }
        ctx.save(); ctx.globalAlpha = (1 - k) * (Math.floor(now * 14) % 2 ? 1 : .55); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(P.x, shipY, RS + 4, m.a - .42, m.a + .42); ctx.strokeStyle = INKC; ctx.lineWidth = 16; ctx.stroke(); ctx.strokeStyle = '#ff3b5c'; ctx.lineWidth = 9; ctx.stroke();
        ctx.restore();
        if (k < .05 && !m.p) { m.p = 1; const [mx2, my2] = dodge(clamp(P.x + Math.cos(m.a) * 120, 90, 710), clamp(shipY + Math.sin(m.a) * 110, 184, 528), 160, 40, labelObs(q => q !== 'miss'), P); popText(pops, 'miss', 'MISSED!', mx2, my2, '#ff6b81', 28, .9); }
      }
      if (!(resKind === 'lose' && rt > .15)) { if (!shieldOn()) ctx.globalAlpha = .3 + .12 * Math.sin(now * 6); drawShield(P.x, shipY, A, shCol, pulse, pilot); ctx.globalAlpha = 1; }
      /* where the last shots smacked into the shield: a white-hot dent that heals */
      for (let i = dents.length - 1; i >= 0; i--) {
        const dn = dents[i], k = (now - dn.t0) / .32; if (k >= 1) { dents.splice(i, 1); continue; }
        ctx.save(); ctx.lineCap = 'round'; ctx.globalAlpha = 1 - k;
        ctx.beginPath(); ctx.arc(P.x, shipY, RS + k * 10, dn.a - .2 - k * .3, dn.a + .2 + k * .3); ctx.strokeStyle = '#fff'; ctx.lineWidth = 15 * (1 - k) + 2; ctx.stroke();
        glow(shCol, P.x + Math.cos(dn.a) * RS, shipY + Math.sin(dn.a) * RS, 50 + k * 30, 1 - k);
        ctx.restore();
      }
      drawShip(P.x, shipY, { col: shipCol, mood, tilt, sq: sqz, vx: Vv.x, vy: Vv.y, spin, alpha: blinkOff ? .45 : 1, dmg: hits >= 2 || resKind === 'lose' ? 1 : 0 });
      if (resKind === 'win') {   // the five stars come out to dance around the saucer
        const k = outBack(clamp(rt / .5, 0, 1)), fade = clamp(2.6 - rt, 0, 1);
        if (fade > 0) for (let i = 0; i < NEED; i++) { const a = rt * 2.6 + i * TAU / NEED, sx = P.x + Math.cos(a) * 104 * k, sy = shipY + Math.sin(a) * 66 * k - 6;
          ctx.save(); ctx.globalAlpha = fade; ctx.translate(sx, sy); ctx.rotate(Math.sin(rt * 6 + i) * .3); ctx.scale(k, k); glow(GOLD, 0, 0, 34, .6); starPath(ctx, 0, 0, 15, 7, 5, -Math.PI / 2); inked(GOLD, 5);
          starPath(ctx, -1.5, -2, 7, 3.5, 5, -Math.PI / 2); ctx.fillStyle = GOLDL; ctx.fill(); ctx.restore(); }
      }
      if (!g.result) {
        const T2 = tagPos(P, shipY, A);
        if (T2) { if (!tagNow) tagNow = { x: T2.x, y: T2.y }; const k = Math.min(1, dtD * 14); tagNow.x += (T2.x - tagNow.x) * k; tagNow.y += (T2.y - tagNow.y) * k; tag(tagNow.x, tagNow.y, 'FRIEND', pilot ? shCol : shipCol, T2.below && Math.abs(tagNow.y - T2.y) < 20); }
        else tagNow = null;
      }
      /* bounced orbs */
      for (const f of rfs) drawOrb(f.x, f.y, f.d, true, shCol, 0);
      /* pointer feedback */
      if (!g.result) {
        if (pilot && tgt && !(kx || ky)) { const k = .5 + .5 * Math.sin(now * 8); ctx.strokeStyle = rgba(shipCol, .9); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tgt.x, tgt.y, 14 + k * 4, 0, TAU); ctx.stroke(); ctx.fillStyle = shipCol; ctx.beginPath(); ctx.arc(tgt.x, tgt.y, 4, 0, TAU); ctx.fill(); }
        if (!pilot && ptr && !kr) { const k = .5 + .5 * Math.sin(now * 8); ctx.save(); ctx.setLineDash([3, 10]); ctx.strokeStyle = rgba(shCol, .55); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(P.x + Math.cos(sa) * (RS + 14), P.y + Math.sin(sa) * (RS + 14)); ctx.lineTo(ptr.x, ptr.y); ctx.stroke(); ctx.restore(); ctx.beginPath(); ctx.arc(ptr.x, ptr.y, 12 + k * 3, 0, TAU); ctx.strokeStyle = shCol; ctx.lineWidth = 3; ctx.stroke(); }
      }
      drawSparks(sparks, dtP);
      /* stars flying to the panel */
      for (let i = flyers.length - 1; i >= 0; i--) {
        const f = flyers[i], k = clamp((now - f.t0) / .5, 0, 1), e = ease(k), tx = starX(f.k - 1), ty = PANEL.y + PANEL.h / 2;
        if (k >= 1) { flyers.splice(i, 1); continue; }
        const fx = lerp(f.x, tx, e), fy = lerp(f.y, ty, e) - Math.sin(k * Math.PI) * 60;
        if (Math.random() < .5) spark(sparks, fx, fy, GOLDL, 1, 40, 1, .35);
        ctx.save(); ctx.translate(fx, fy); ctx.rotate(k * 6); ctx.scale(1.4 - k * .6, 1.4 - k * .6); starPath(ctx, 0, 0, 16, 7.5, 5, -Math.PI / 2); inked(GOLD, 6); ctx.restore();
      }
      drawPanel(got, gotT, hits, hitT, resKind === 'win' ? rt : -1);
      drawPops(pops);
      /* the first-second callout, in the band under the panel (the first star never spawns there); it fades where the saucer or the star sits */
      if (g.c < 2 && !g.result) {
        const k = outBack(clamp(g.c / .3, 0, 1)), cy = 174, over = (px, py, r) => Math.abs(px - 400) < 210 + r && Math.abs(py - cy) < 22 + r;
        let al = clamp((2 - g.c) / .4, 0, 1); if ((G && over(G.x, G.y, 36)) || (Math.abs(P.x - 400) < 260 && cy > P.y - 140 && cy < P.y + 50)) al *= .35;
        ctx.save(); ctx.globalAlpha = al; ctx.translate(400, cy); ctx.scale(k, k);
        txt(pilot ? 'GRAB THE STARS!' : 'BLOCK THE SHOTS!', 0, 0, 36, pilot ? GOLD : '#fff', 'center', 440); ctx.restore();
        if (!pilot) {   // turning arrows around the saucer
          ctx.save(); ctx.globalAlpha = clamp((2 - g.c) / .4, 0, 1) * .9 * (armed ? clamp(1 - (now - armT) / .25, 0, 1) : 1); ctx.lineCap = 'round'; const r0 = now * 2.4;
          for (const o2 of [0, Math.PI]) { ctx.beginPath(); ctx.arc(P.x, P.y, RS + 26, r0 + o2, r0 + o2 + 1.6); ctx.strokeStyle = INKC; ctx.lineWidth = 11; ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.stroke();
            const ea = r0 + o2 + 1.6, hx = P.x + Math.cos(ea) * (RS + 26), hy = P.y + Math.sin(ea) * (RS + 26); ctx.save(); ctx.translate(hx, hy); ctx.rotate(ea + Math.PI / 2); ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -10); ctx.lineTo(-6, 10); ctx.closePath(); inked('#fff', 4); ctx.restore(); }
          ctx.restore();
        }
      }
    },
    move(p) {
      if (g.result) return;
      if (pilot) {
        if (drag) tgt = { x: clamp(drag.sx + (p.x - drag.fx) * 1.3, X0, X1), y: clamp(drag.sy + (p.y - drag.fy) * 1.3, Y0, Y1) };   // touch: drag the saucer from anywhere, so the thumb never hides it
        else { preTgt = tgt; tgt = { x: clamp(p.x, X0, X1), y: clamp(p.y, Y0, Y1) }; }
      } else { ptr = { x: p.x, y: p.y }; if (!armed) armT = now; armed = true; }
    },
    down(p) {
      if (g.result) return;
      if (pilot && TOUCH) { tgt = preTgt; drag = { fx: p.x, fy: p.y, sx: x, sy: y }; return; }
      g.move(p);
    },
    up() { drag = null; },
    key(e) {
      if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return;
      const k = keyDir(e.code); if (!k || g.result) return; held[k] = 1; keysChanged();
    },
    keyup(e) { const k = keyDir(e.code); if (!k) return; held[k] = 0; keysChanged(); },
  };
  /* for test/duo-bots/shield.js: each getter only exposes what that role sees on its own screen */
  g.dbg = {
    RS, goal: () => pilot ? goal() : null, pos: () => pilot ? { x, y } : null,
    ship: () => pilot ? null : shipView(),
    orbs: () => pilot ? [] : shots.filter(s => s.st === 'fly').map(s => { const [ox, oy] = orbAt(s); return { x: ox, y: oy, a: s.a }; }),
    charging: () => { if (pilot) return null; let up = null; for (const s of shots) if (s.st === 'aim' && (!up || s.t < up.t)) up = s; return up ? muzzle(up.c, up.a) : null; },
    hits: () => hits, got: () => got,
  };
  wire(g, D, 0, sp, 'du_shield');
  return g;
}
reg('du_shield', duShield, 'BODYGUARD'); REGMAP.du_shield.duo = true;

/* ───────────── intro-card demos (520×240 frame) ───────────── */
let DSKY = null;
function demoSky(w, h) {
  if (!DSKY) { DSKY = ctx.createLinearGradient(0, 0, 0, 240); DSKY.addColorStop(0, '#120a34'); DSKY.addColorStop(1, '#1d1450'); }
  ctx.fillStyle = DSKY; ctx.fillRect(0, 0, w, h);
  glow('#7c3cff', 120, 80, 160, .35); glow('#12b5d3', 420, 190, 150, .25); glow('#ff2f8e', 400, 40, 110, .2);
  const r = mulberry32(5); for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * h, tw = .5 + .5 * Math.sin(now * 3 + i); ctx.fillStyle = `rgba(255,255,255,${.25 + tw * .5})`; ctx.fillRect(x, y, 2, 2); }
}
/* the real colours on the intro card: the pilot's and the shield player's, and what to call the OTHER piece from the viewer's seat */
function demoInfo(r) {
  let pc = '#D97757', sc = '#6EA8FE', label = 'FRIEND';
  try {
    const m = me(), pn = party.room.players.find(p => !p.left && p.id !== party.you.id), mine = cur.role;
    if (m && pn && (mine === 0 || mine === 1)) { pc = mine === 0 ? m.color : pn.color; sc = mine === 0 ? pn.color : m.color; if (mine !== r) label = 'YOU'; }
  } catch (e) {}
  if (pc === sc) { pc = '#D97757'; sc = '#6EA8FE'; }
  return { pc, sc, label };
}
function demoPilot(t) {
  const I = demoInfo(0), L = 3, ph = t % L, flip = Math.floor(t / L) % 2, A = flip ? [400, 150] : [122, 150], B = flip ? [142, 128] : [378, 128], G = flip ? [86, 100] : [434, 100];
  const fk = ease(clamp((ph - .05) / 1.3, 0, 1)), sk = ease(clamp((ph - .3) / 1.5, 0, 1)), caught = ph > 1.75;
  const sx = lerp(A[0], B[0], sk), sy = lerp(A[1], B[1], sk) - Math.sin(sk * Math.PI) * 26, fx = lerp(A[0], B[0], fk) + 34, fy = lerp(A[1], B[1], fk) + 58;
  demoSky(520, 240);
  if (!caught) drawGoal(G[0], G[1], 1, 0);
  else { const q = clamp((ph - 1.75) / .5, 0, 1); ctx.globalAlpha = 1 - q; glow(GOLD, G[0], G[1], 90 * (1 + q), .8); starPath(ctx, G[0], G[1] - q * 40, 32 + q * 14, 15 + q * 7, 5, -Math.PI / 2); inked(GOLD, 8); ctx.globalAlpha = 1;
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + q, r = 30 + q * 50; twinkle(G[0] + Math.cos(a) * r, G[1] + Math.sin(a) * r, 8 * (1 - q), i % 2 ? '#fff' : GOLDL); }
    txt('+1', G[0] + (flip ? 34 : -34), G[1] - 30 - q * 30, 38, GOLD); }
  const sa = flip ? .5 : Math.PI - .5;
  drawShield(sx, sy, sa, I.sc, 0, true);
  const mv = sk > 0 && sk < 1 ? (B[0] - A[0]) : 0;
  drawShip(sx, sy, { col: I.pc, vx: mv, vy: 0, tilt: mv / 1800, mood: caught ? 'happy' : null, s: 1 });
  tag(clamp(sx + (flip ? 70 : -70), 50, 470), sy - 84, I.label, I.sc);
  ctx.save(); ctx.setLineDash([3, 9]); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx + 14, sy + 34); ctx.lineTo(fx, fy - 14); ctx.stroke(); ctx.restore();
  demoFinger(fx, fy, ph < 1.9, 0);
}
function demoShield(t) {
  const I = demoInfo(1), L = 2.4, ph = t % L, side = Math.floor(t / L) % 2, cx = 262, cy = 132;
  const C = side ? { x: 452, y: 62, rest: 2.62, st: 80, bx: 470, by: 116 } : { x: 72, y: 186, rest: -.42, st: 80, bx: 58, by: 132 };
  const a0 = Math.atan2(cy - C.y, cx - C.x), [mx, my] = [C.x + Math.cos(a0) * BARREL, C.y + Math.sin(a0) * BARREL], hitD = Math.hypot(cx - mx, cy - my) - RS;
  const tFire = .55, tHit = 1.0, tKO = 1.4, want = a0 + Math.PI + (side ? .5 : -.5), from = want + (side ? -2.2 : 2.2), sa = from + wrapA(want - from) * ease(clamp((ph - .05) / .4, 0, 1));
  demoSky(520, 240);
  const ch = ph < tFire ? clamp(ph / tFire, 0, 1) : 0, koOn = ph > tKO, F = [clamp(cx + Math.cos(sa) * 112, 22, 498), clamp(cy + Math.sin(sa) * 100, 22, 218)];
  if (ch > 0) { const off = (now * 140) % 30; ctx.save(); ctx.translate(mx, my); ctx.rotate(a0); ctx.lineCap = 'round'; for (let i = 0; i < 4; i++) { const d = 20 + i * 30 + off; ctx.globalAlpha = ch * (1 - i / 4); ctx.beginPath(); ctx.moveTo(d - 8, -10); ctx.lineTo(d + 2, 0); ctx.lineTo(d - 8, 10); ctx.strokeStyle = INKC; ctx.lineWidth = 9; ctx.stroke(); ctx.strokeStyle = EO; ctx.lineWidth = 4.5; ctx.stroke(); } ctx.restore(); ctx.globalAlpha = 1; }
  drawCannon(C, { ang: koOn ? C.rest + Math.sin(now * 3) * .4 + .3 : a0, charge: ch, locked: ch > .5, ko: koOn ? 1 : 0, recoil: ph > tFire ? clamp(1 - (ph - tFire) / .28, 0, 1) : 0 });
  const pulse = ph > tHit && ph < tHit + .3 ? 1 - (ph - tHit) / .3 : 0;
  drawShield(cx, cy, sa, I.sc, pulse, false);
  drawShip(cx, cy, { col: I.pc, vx: 0, vy: 0, mood: ph > tHit ? 'happy' : null, s: .95 });
  tag(cx, cy - 100, I.label, I.pc);
  if (ph >= tFire && ph < tHit) { const k = (ph - tFire) / (tHit - tFire) * hitD; drawOrb(mx + Math.cos(a0) * k, my + Math.sin(a0) * k, a0, false, EO, 0); }
  else if (ph >= tHit && ph < tKO) {
    const k = (ph - tHit) / (tKO - tHit), px = mx + Math.cos(a0) * hitD, py = my + Math.sin(a0) * hitD;
    drawOrb(lerp(px, C.x, k), lerp(py, C.y, k), a0 + Math.PI, true, I.sc, 0);
    if (k < .7) { ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(px, py, 10 + k * 50, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; txt('PING!', px + (side ? 26 : -4), Math.max(26, py - 44 - k * 14), 30, '#fff'); }
  } else if (koOn) { const k = outBack(clamp((ph - tKO) / .2, 0, 1)); ctx.save(); ctx.translate(side ? 380 : 132, side ? 30 : 118); ctx.scale(k, k); txt('KO!', 0, 0, 36, GOLD); ctx.restore(); }
  demoFinger(F[0], F[1], true, 0);
}
DUO.INFO.du_shield = [['PILOT', 'GRAB THE STARS', 'DRAG / ARROWS TO FLY'], ['SHIELD', 'BLOCK THE SHOTS', 'POINT / ◄ ► TO TURN']];
DUO.DEMOS.du_shield = [demoPilot, demoShield];
})();
