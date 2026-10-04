'use strict';
/* ═════════ DUO · GRANNY'S WATCHING (du_granny) ═════════
   Night. Two kids tiptoe from the hallway to the fridge (cake inside) behind grandma, who knits in her wingback armchair facing the TV.
   Hold (pointer / Space / touch) to tiptoe, let go to freeze. Grandma whips her head round at seeded moments: if EITHER kid is moving
   while she looks, both are caught (her head spins like an owl and both kids turn into garden gnomes). Both kids must reach the fridge.
   Each kid has its own early warning, and only on its own screen:
   - NEEDLE SPY (role 0, JUDGE): sees her knitting needles (and hears them click). They STOP and her ear twitches before she turns.
     (On the other screen a big fern in front of the armchair hides her hands.)
   - KETTLE SPY (role 1): sees her reflection in the shiny kettle on the stove: her eyes slide round in it before she turns.
     (On the other screen the kettle is steaming, so the reflection is fogged.)
   Every real look is announced to ONE kid only (seeded), so the other one has to read its friend: a friend who suddenly freezes
   (drawn stiff, with a "!") is the warning. Fake-outs: a private false alarm (she just stops to count stitches / glances at the kettle)
   and a shared twitch of the head that never becomes a look.
   Netcode: the look schedule comes from the seed, so both screens show the same grandma at the same time. Each client judges ONLY its
   own kid against that schedule (its own input, no lag; GRACE s after she faces the room), then relays the facts: 'caught {x}' and
   'in {at}' (reached the fridge, stamped with its clock). 'k [x, m]' is the kid's position + moving flag, coalesced, at most ~10/s;
   the partner draws it ~150 ms behind (track()). The JUDGE (role 0) owns the verdict: any 'caught' (its own or the friend's) = lose,
   both 'in' = win, time limit = lose (it waits up to .25 s for a friend's 'in' stamped before the limit). */
(function () {
const { clamp, mkR, wire, track, demoFinger } = DUO;
const TAU = Math.PI * 2;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
const lerp = (a, b, k) => a + (b - a) * k;
const okHex = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

/* ───────────── layout (800×600; HUD keeps y<58, the top-left box (x<310, y<150), the top-right LEAVE and y>552) ───────────── */
const FLOOR = 392;                                    // where the wall meets the floor
const LANE = [414, 484];                             // feet of kid 0 (back) and kid 1 (front)
const X0 = 326, GOAL = 626;                          // start (behind the armchair) and the fridge
const HX = 196, HY = 192;                            // grandma's head
const FRX = 648, FRY = 128, FRW = 136, FRH = FLOOR + 6 - 128;   // the fridge
const KTX = 556, KTY = 300;                          // kettle (bottom centre) on the stove
const PLATE = [262, 500, 276, 44];
const KU = 5.2;                                      // the kids' claude() unit
const CHAIRP = 'M116 274 C112 244 132 232 150 238 L242 238 C262 232 280 244 276 274 L276 392 L116 392 Z';   // the wingback, from behind
const WHIP = .16, BACK = .3, GRACE = .07, FAKE = .6, TWITCH = .34;

/* palette */
const SKIN = '#ffd2b3', SKIN2 = '#e9a98a', HAIR = '#e8e6f0', HAIR2 = '#b9b4cc', CARD = '#ff8fb6', CARD2 = '#d9628d';
const CHAIR = '#7a5cc4', CHAIR2 = '#5a3f9e', CHAIRL = '#9f86e0';
const STEEL = '#cfd8e6', STEEL2 = '#8f9cb3';

/* ───────────── tiny drawing kit (X can be swapped for an offscreen context) ───────────── */
let X = ctx;
const PM = {}; const P = d => PM[d] || (PM[d] = new Path2D(d));
function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rot, 0, TAU); }
function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
function inkP(p, fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(p); } if (fill) { X.fillStyle = fill; X.fill(p); } }
/* cel shading with a shifted copy of the same shape: base on top, the shade shows as a crescent on the (sx, sy) side */
function cel(p, base, shade, sx, sy, o = 4) { inkP(p, shade, o); X.save(); X.clip(p); X.translate(-sx, -sy); X.fillStyle = base; X.fill(p); X.restore(); }
function line(pts, w, col) { X.beginPath(); pts.forEach(([x, y], i) => i ? X.lineTo(x, y) : X.moveTo(x, y)); X.lineCap = 'round'; X.lineJoin = 'round'; X.lineWidth = w + 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
function pill(x, y, label, col, up) {                // a name tag with a little pointer (down, up, or 'left': x,y is then the pointer tip), e.g. YOU / YOUR FRIEND
  X.font = '700 15px Fredoka, "Helvetica Neue", Arial, sans-serif'; const s = t(label), w = Math.min(150, X.measureText(s).width + 22);
  if (up === 'left') { X.beginPath(); X.moveTo(x, y); X.lineTo(x + 12, y - 8); X.lineTo(x + 12, y + 8); X.closePath(); ink(col, 3); x += 8 + w / 2; }
  else { const py = up ? -1 : 1; X.beginPath(); X.moveTo(x - 8, y + 11 * py); X.lineTo(x, y + 21 * py); X.lineTo(x + 8, y + 11 * py); X.closePath(); ink(col, 3); }
  rr(x - w / 2, y - 12, w, 24, 12); ink(col, 3); X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + 6, y - 9, w - 12, 6, 3); X.fill();
  txt(label, x, y + 1, 15, INK, 'center', w - 12);
}
/* a word on a chunky coloured badge (feedback that stays readable over any background) */
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
function keyCap(x, y, s) { X.font = '700 15px Fredoka, Arial, sans-serif'; const w = Math.max(26, X.measureText(t(s)).width + 14); rr(x - w / 2, y - 12, w, 24, 6); ink('#fff', 2.5); txt(s, x, y + 1, 15, INK, 'center', w - 6); }
function puff(x, y, r, a) { if (a <= 0) return; X.globalAlpha = clamp(a, 0, 1); for (const [dx, dy, k] of [[0, 0, 1], [-r * .7, r * .2, .7], [r * .7, r * .15, .75], [0, -r * .5, .7]]) { el(x + dx, y + dy, r * k, r * k * .9); ink('#f4f1ff', 3); } X.globalAlpha = 1; }
function sweat(x, y, s, T) { const k = (T * 2.2) % 1; X.globalAlpha = 1 - k; X.save(); X.translate(x + k * 6, y + k * 14); X.scale(s, s); X.beginPath(); X.moveTo(0, -9); X.quadraticCurveTo(7, 2, 0, 5); X.quadraticCurveTo(-7, 2, 0, -9); ink('#9fe3ff', 2); X.restore(); X.globalAlpha = 1; }

/* two thin blocky arms from claude()'s side stubs, each with a little square hand (drawn before claude(), so the body hides the shoulder).
   la / ra: arm angles (0 = straight up, + leans right), k: 0..1 how far they are raised */
function arms(u, la, ra, k, col) {
  if (k <= .02) return; const ol = Math.max(3, u * .5), L = 3.3 * u * k, aw = 1.2 * u, hs = 2 * u, gap = .35 * u;
  const one = (sx, an) => {
    X.save(); X.translate(sx * 6.6 * u, -5.2 * u); X.rotate(an);
    X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs / 2 - ol, -L - gap - hs - ol, hs + ol * 2, hs + ol * 2);
    X.fillStyle = col; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs / 2, -L - gap - hs, hs, hs);
    X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs / 2, -L - gap - hs, hs * .45, hs * .4);
    X.restore();
  };
  one(-1, la); one(1, ra);
}

/* ───────────── grandma's head. th: 0 = we see the back of her head (bun), π = she faces the room. Past π/2 the face shows,
   squashed by |cos th| like a cartoon head turn; an owl spin is just th running on. ───────────── */
function grannyHead(x, y, s, th, o) {
  const c = Math.cos(th), front = c < 0, sx = Math.max(.1, Math.abs(c)), T = o.t || 0;
  X.save(); X.translate(x, y); X.scale(s, s);
  // the bun + the hair dome keep the same silhouette both ways, so the turn reads
  X.save(); X.scale(sx, 1);
  if (o.mop) {                                       // the decoy: a mop head with her glasses on
    line([[0, -10], [10, -120]], 9, '#c98443');
    for (let i = 0; i < 13; i++) { const a = -Math.PI + i / 12 * Math.PI, L = 46 + (i % 3) * 6; X.save(); X.rotate(a + Math.PI / 2); rr(-5, -6, 10, L, 5); ink('#f2ead2', 2.5); X.restore(); }
    el(0, -6, 30, 22); ink('#e6dcbc', 3);
    for (const sd of [-1, 1]) { X.beginPath(); X.arc(sd * 15, 0, 13, 0, TAU); ink('rgba(220,240,255,.5)', 3); }
    X.strokeStyle = INK; X.lineWidth = 5; X.beginPath(); X.moveTo(-3, 0); X.lineTo(3, 0); X.stroke();
    X.restore(); X.restore(); return;
  }
  // head: a ring of perm curls makes the same bumpy silhouette from both sides
  for (let i = 0; i < 9; i++) { const a = -Math.PI * 1.05 + i / 8 * Math.PI * 1.1; X.beginPath(); X.arc(Math.cos(a) * 34, Math.sin(a) * 36 - 6, 13, 0, TAU); ink(null, 4); }
  el(0, 0, 38, 42); ink(null, 4);
  for (let i = 0; i < 9; i++) { const a = -Math.PI * 1.05 + i / 8 * Math.PI * 1.1; X.beginPath(); X.arc(Math.cos(a) * 34, Math.sin(a) * 36 - 6, 13, 0, TAU); X.fillStyle = HAIR; X.fill(); }
  el(0, 0, 38, 42); X.fillStyle = front ? SKIN : HAIR; X.fill();
  if (!front) {                                      // back of the head: curls, a nape, the big bun with a pencil stuck in it
    X.save(); el(0, 0, 38, 42); X.clip(); X.fillStyle = HAIR2; el(14, 18, 34, 30); X.fill(); X.fillStyle = HAIR; el(-6, -6, 32, 34); X.fill();
    X.strokeStyle = HAIR2; X.lineWidth = 3; X.lineCap = 'round';
    for (const [cx, cy] of [[-16, -12], [10, -18], [-4, 8], [18, 4], [-20, 14]]) { X.beginPath(); X.arc(cx, cy, 6, .3, 4.6); X.stroke(); }
    X.fillStyle = SKIN; X.fillRect(-14, 30, 28, 16); X.fillStyle = SKIN2; X.fillRect(-14, 30, 28, 4); X.restore();
    for (let i = 0; i < 9; i++) { const a = -Math.PI * 1.05 + i / 8 * Math.PI * 1.1; X.fillStyle = 'rgba(255,255,255,.6)'; el(Math.cos(a) * 34 - 4, Math.sin(a) * 36 - 10, 4, 2.5, -.5); X.fill(); }
    line([[8, -48], [34, -84]], 4, '#ffd23f'); X.fillStyle = '#ff7aa8'; el(34, -84, 4, 4); X.fill();
    el(0, -46, 26, 20); ink(HAIR, 4); X.fillStyle = HAIR2; el(6, -40, 18, 9); X.fill(); X.fillStyle = '#fff'; el(-8, -54, 9, 5, -.3); X.fill();
    X.strokeStyle = HAIR2; X.lineWidth = 3; X.beginPath(); for (let i = 0; i < 30; i++) { const a = i * .45, r = 2 + i * .45; X.lineTo(Math.cos(a) * r, -46 + Math.sin(a) * r * .75); } X.stroke();
    // a bow (the only thing that says "back")
    X.save(); X.translate(0, 34); for (const sd of [-1, 1]) { X.beginPath(); X.moveTo(0, 0); X.lineTo(sd * 18, -10); X.lineTo(sd * 18, 10); X.closePath(); ink('#ff5d8f', 3); } el(0, 0, 6, 6); ink('#ff5d8f', 3); X.restore();
  } else {                                           // the face: perm curls, huge glasses with magnified eyes, a mole, a lipstick mouth
    X.save(); el(0, 0, 38, 42); X.clip(); X.fillStyle = HAIR; el(0, -30, 40, 18); X.fill(); for (let i = 0; i < 5; i++) { el(-28 + i * 14, -14, 8, 7); X.fill(); } X.restore();
    el(0, -44, 24, 18); ink(HAIR, 4);
    X.fillStyle = 'rgba(255,120,140,.5)'; el(-24, 18, 9, 6); X.fill(); el(24, 18, 9, 6); X.fill();
    X.strokeStyle = 'rgba(200,120,100,.6)'; X.lineWidth = 2; for (const sd of [-1, 1]) { X.beginPath(); X.moveTo(sd * 30, 2); X.quadraticCurveTo(sd * 34, 10, sd * 30, 16); X.stroke(); }
    const mood = o.mood || 'stare', big = mood === 'aha' ? 1.25 : 1, eyeK = mood === 'cake' ? 0 : 1;
    // nose
    el(0, 12, 8, 7); ink('#ffb79a', 2.5);
    // mouth
    X.strokeStyle = INK; X.lineWidth = 4;
    if (mood === 'aha') { el(0, 30, 10, 9); ink('#9c1c3c', 3); X.fillStyle = '#ff6b8a'; el(0, 35, 6, 3); X.fill(); }
    else if (mood === 'cake') { el(0, 28, 12, 6); ink('#ff8fb6', 3); X.fillStyle = '#fff6e0'; el(-4, 27, 3, 2); X.fill(); }
    else { X.beginPath(); X.moveTo(-10, 30); X.quadraticCurveTo(0, 26, 10, 30); X.stroke(); X.strokeStyle = '#e8436e'; X.lineWidth = 3; X.stroke(); }
    X.fillStyle = '#7a4a3a'; el(16, 24, 2.6, 2.6); X.fill();
    // glasses: big lenses, eyes swim in them
    for (const sd of [-1, 1]) {
      const gx = sd * 17, gy = -6;
      X.beginPath(); X.arc(gx, gy, 16, 0, TAU); ink('rgba(230,248,255,.9)', 3.5);
      if (eyeK) {
        el(gx, gy + 1, 11 * big, 12 * big); X.fillStyle = '#fff'; X.fill();
        const lk = o.look || 0; X.fillStyle = INK; el(gx + 3 + lk * 3, gy + 2, 6 * big, 7 * big); X.fill(); X.fillStyle = '#fff'; el(gx + 1 + lk * 3, gy - 1, 2.2, 2.2); X.fill();
        X.strokeStyle = INK; X.lineWidth = 4; X.beginPath();
        if (mood === 'aha') { X.moveTo(gx - 12, gy - 22 - 4); X.lineTo(gx + 12, gy - 18 - 4); }
        else { X.moveTo(gx - 12, gy - 19); X.lineTo(gx + 12, gy - 23 + sd * 3); }
        X.stroke();
      } else { X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(gx - 8, gy + 3); X.quadraticCurveTo(gx, gy - 6, gx + 8, gy + 3); X.stroke(); }
      X.fillStyle = 'rgba(255,255,255,.75)'; el(gx - 7, gy - 8, 4, 2.5, -.6); X.fill();
      if (o.flash) { X.globalAlpha = o.flash; X.fillStyle = '#fff'; X.beginPath(); X.arc(gx, gy, 16, 0, TAU); X.fill(); X.globalAlpha = 1; }
    }
    X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(-2, -6); X.lineTo(2, -6); X.stroke();
    if (o.frost) { X.fillStyle = 'rgba(220,245,255,.85)'; for (const sd of [-1, 1]) { X.beginPath(); X.moveTo(sd * 5, 18); X.lineTo(sd * 3, 30); X.lineTo(sd * 1, 18); X.fill(); } }
  }
  // ears poke out of the curls (the left one twitches: motion arcs)
  const tw = o.ear || 0;
  for (const sd of [-1, 1]) {
    const tws = sd < 0 ? tw : 0, ang = sd * .2 + Math.sin(T * 60) * .35 * tws;
    X.save(); X.translate(sd * 40, 6); X.rotate(ang); el(0, 0, 9 + tws * 3, 13 + tws * 3); ink(SKIN, 3); el(sd * 1, 1, 4, 7); X.fillStyle = SKIN2; X.fill(); X.restore();
  }
  if (tw > .05) { X.strokeStyle = INK; X.lineWidth = 3; X.globalAlpha = tw; for (const r of [20, 28]) { X.beginPath(); X.arc(-40, 6, r, Math.PI * .8, Math.PI * 1.2); X.stroke(); } X.globalAlpha = 1; }
  X.restore();
  X.restore();
}

/* the knitting (role 0's tell): two needles crossing over a little scarf; they click, or stand still */
function knitting(x, y, T, on) {
  const a = on ? Math.sin(T * 18) * .22 : 0;
  // her sleeve comes round the side of the chair, the scarf hangs off the needles
  line([[x + 40, y + 34], [x + 10, y + 8]], 16, CARD);
  X.save(); X.translate(x, y); rr(-20, 4, 40, 50, 6); ink('#5cd2ff', 3); X.fillStyle = '#ffe14d'; X.fillRect(-20, 18, 40, 7); X.fillRect(-20, 36, 40, 7);
  X.save(); X.rotate(-.55 + a); rr(-3, -54, 6, 64, 3); ink('#f2c14e', 2.5); el(0, -56, 5, 5); ink('#ff5d8f', 2); X.restore();
  X.save(); X.rotate(.55 - a); rr(-3, -54, 6, 64, 3); ink('#f2c14e', 2.5); el(0, -56, 5, 5); ink('#ff5d8f', 2); X.restore();
  for (const sd of [-1, 1]) { el(sd * 9 + Math.sin(a * 4) * sd * 2, 0, 9, 8); ink(SKIN, 3); }
  X.restore();
}
/* yarn ball on the floor (its thread goes up to the needles) */
function yarn(x, y, T, on, nx, ny) {
  X.strokeStyle = '#3aa0d8'; X.lineWidth = 3; X.beginPath(); X.moveTo(x, y - 14); X.quadraticCurveTo((x + nx) / 2 - 20, (y + ny) / 2 + 40, nx, ny); X.stroke();
  X.save(); X.translate(x, y); X.rotate(on ? T * 2 : 0); X.beginPath(); X.arc(0, -14, 16, 0, TAU); ink('#5cd2ff', 3);
  X.strokeStyle = '#2f8fc6'; X.lineWidth = 2.5; for (let i = 0; i < 3; i++) { X.beginPath(); X.arc(0, -14, 11 - i * 3, i, i + 2.2); X.stroke(); } X.restore();
}

/* the kettle: k = how far her eyes have slid round in the reflection (0 = bun, 1 = eyes on you), fog = the steam on the other screen */
function kettle(x, y, T, peek, fog, shakeK) {
  X.save(); X.translate(x + (shakeK ? Math.sin(T * 70) * 1.6 * shakeK : 0), y);
  // handle + spout
  X.lineWidth = 12; X.strokeStyle = INK; X.lineCap = 'round'; X.beginPath(); X.arc(0, -58, 26, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); X.lineWidth = 6; X.strokeStyle = '#2b2440'; X.stroke();
  X.beginPath(); X.moveTo(-34, -24); X.quadraticCurveTo(-52, -30, -56, -50); X.lineTo(-48, -52); X.quadraticCurveTo(-44, -36, -28, -34); X.closePath(); ink(STEEL, 3);
  // body
  const body = P('M-36 0 C-44 -30 -32 -56 0 -58 C32 -56 44 -30 36 0 Z');
  cel(body, STEEL, STEEL2, -6, 0, 4);
  rr(-12, -66, 24, 10, 5); ink('#2b2440', 3);
  // the reflection (a squashed little grandma in the chrome)
  X.save(); X.clip(body); X.translate(4, -28); X.scale(.34, .3);
  if (!fog) {
    X.fillStyle = 'rgba(60,40,110,.25)'; X.fillRect(-120, -120, 240, 240);
    X.save(); X.globalAlpha = .9; grannyHead(0, 10, 1, 0, { t: T }); X.restore();
    if (peek > .02) {                                // her eyes slide into view in the chrome
      X.globalAlpha = Math.min(1, peek * 1.4);
      for (const sd of [-1, 1]) { const ex = sd * 15 + 20 * (1 - peek); el(ex, 0, 11, 12); ink('#fff', 3); X.fillStyle = INK; el(ex + 4, 2, 6, 7); X.fill(); }
      X.strokeStyle = INK; X.lineWidth = 6; X.beginPath(); X.moveTo(-28, -20); X.lineTo(-4, -24); X.moveTo(4, -24); X.lineTo(28, -20); X.stroke();
      X.globalAlpha = 1;
    }
  }
  X.restore();
  X.fillStyle = 'rgba(255,255,255,.8)'; X.save(); X.clip(body); el(-20, -34, 6, 16, .3); X.fill(); X.restore();
  X.restore();
  if (fog) {                                         // steam puffing out of the spout + a fogged bloom over the chrome
    for (let i = 0; i < 4; i++) { const k = (T * .8 + i / 4) % 1; puff(x - 52 + Math.sin(T * 2 + i) * 6 - k * 10, y - 56 - k * 70, 10 + k * 14, (1 - k) * .9); }
    X.globalAlpha = .75; el(x + 2, y - 30, 30, 22); X.fillStyle = '#f4f1ff'; X.fill(); X.globalAlpha = 1;
  }
}

/* a fern in a pot (only on the kettle spy's screen: it hides grandma's hands) */
function fern(x, y, T) {
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * .32 + Math.sin(T * 1.4 + i) * .03, L = 120 - Math.abs(i - 3) * 14;
    X.save(); X.translate(x, y - 50); X.rotate(a + Math.PI / 2);
    X.beginPath(); X.moveTo(0, 0); X.quadraticCurveTo(14, -L * .5, 0, -L); X.quadraticCurveTo(-14, -L * .5, 0, 0); ink(i % 2 ? '#3fb260' : '#5bcf72', 3);
    X.strokeStyle = '#2f8a48'; X.lineWidth = 2; X.beginPath(); X.moveTo(0, 0); X.lineTo(0, -L + 6); X.stroke(); X.restore();
  }
  X.beginPath(); X.moveTo(x - 34, y - 56); X.lineTo(x + 34, y - 56); X.lineTo(x + 26, y); X.lineTo(x - 26, y); X.closePath(); ink('#e07b4f', 4);
  X.fillStyle = '#c4613a'; X.fillRect(x - 33, y - 56, 66, 9);
}

/* a garden gnome (what a caught kid becomes): the kid's colour for the coat, red hat, white beard, on a little stone */
function gnome(x, y, s, col, T, k) {
  X.save(); X.translate(x, y); X.scale(s * (.6 + .4 * outBack(k)), s * (.6 + .4 * outBack(k)));
  el(0, -4, 34, 9); ink('#a8a2b8', 3);
  X.beginPath(); X.moveTo(-26, -8); X.quadraticCurveTo(-24, -52, 0, -56); X.quadraticCurveTo(24, -52, 26, -8); X.closePath(); ink(col, 4);
  X.fillStyle = 'rgba(20,16,28,.18)'; X.fillRect(-26, -26, 52, 6);
  rr(-5, -27, 10, 8, 2); ink('#ffd23f', 2);
  // beard + face
  el(0, -66, 18, 15); ink(SKIN, 3);
  X.beginPath(); X.moveTo(-18, -66); X.quadraticCurveTo(-20, -30, 0, -26); X.quadraticCurveTo(20, -30, 18, -66); X.quadraticCurveTo(0, -56, -18, -66); ink('#fff', 3);
  el(0, -64, 7, 6); ink('#ff8a8a', 2.5);
  X.strokeStyle = INK; X.lineWidth = 3; for (const sd of [-1, 1]) { X.beginPath(); X.moveTo(sd * 10 - 4, -72); X.quadraticCurveTo(sd * 10, -75, sd * 10 + 4, -72); X.stroke(); }
  // hat
  X.beginPath(); X.moveTo(-22, -74); X.quadraticCurveTo(0, -84, 22, -74); X.quadraticCurveTo(10, -110, -2, -128 + Math.sin(T * 3) * 2); X.quadraticCurveTo(-14, -100, -22, -74); ink('#ff4d4d', 4);
  X.fillStyle = 'rgba(255,255,255,.3)'; el(-8, -96, 4, 12, .3); X.fill();
  X.restore();
}

/* ───────────── the static room, painted once into an offscreen canvas ───────────── */
let BG = null;
function buildBg() {
  const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H; const old = X; X = cv2.getContext('2d');
  // wallpaper: warm stripes + little flowers, darker towards the top (it is night: one lamp)
  let g = X.createLinearGradient(0, 0, 0, FLOOR); g.addColorStop(0, '#d9a86a'); g.addColorStop(1, '#ffe0a8'); X.fillStyle = g; X.fillRect(0, 0, W, FLOOR);
  X.fillStyle = 'rgba(200,120,70,.16)'; for (let x = 0; x < W; x += 44) X.fillRect(x, 0, 18, FLOOR);
  X.fillStyle = 'rgba(255,120,150,.45)'; for (let y = 30; y < FLOOR - 40; y += 58) for (let x = (y / 58 & 1) * 22 + 13; x < W; x += 44) { for (let i = 0; i < 4; i++) { el(x + Math.cos(i * 1.57) * 4, y + Math.sin(i * 1.57) * 4, 3, 3); X.fill(); } }
  // baseboard + floor planks + a round rug
  rr(-10, FLOOR - 16, W + 20, 20, 3); ink('#9a5f34', 3);
  g = X.createLinearGradient(0, FLOOR, 0, H); g.addColorStop(0, '#b97a46'); g.addColorStop(1, '#8a5530'); X.fillStyle = g; X.fillRect(0, FLOOR + 4, W, H - FLOOR);
  X.strokeStyle = 'rgba(60,30,10,.35)'; X.lineWidth = 3; for (let y = FLOOR + 30; y < H; y += 34) { X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke(); }
  for (let r = 0; r < 7; r++) for (let x = (r % 2) * 90 + 40; x < W; x += 180) { X.beginPath(); X.moveTo(x, FLOOR + 4 + r * 34); X.lineTo(x, FLOOR + 30 + r * 34); X.stroke(); }
  X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, FLOOR + 4); X.lineTo(W, FLOOR + 4); X.stroke();
  el(190, 436, 150, 30); ink('#d94c6a', 4); el(190, 436, 124, 22); X.strokeStyle = '#ffd0dc'; X.lineWidth = 4; X.setLineDash([10, 8]); X.stroke(); X.setLineDash([]);
  // window with the night outside (moon, stars), curtains
  rr(470, 96, 142, 128, 6); ink('#2a2350', 5);
  g = X.createLinearGradient(0, 96, 0, 224); g.addColorStop(0, '#1d1840'); g.addColorStop(1, '#3d3480'); X.fillStyle = g; rr(474, 100, 134, 120, 4); X.fill();
  X.beginPath(); X.arc(578, 132, 18, 0, TAU); ink('#fff3b0', 3); X.fillStyle = '#e8dc96'; el(572, 128, 4, 3); X.fill(); el(584, 140, 3, 2.4); X.fill();
  for (const [sx, sy] of [[492, 118], [520, 150], [500, 190], [552, 180], [596, 196]]) star(sx, sy, 5, 2, 4, 0, '#fff', 0);
  X.fillStyle = INK; X.fillRect(538, 96, 6, 128); X.fillRect(470, 156, 142, 6);
  for (const sd of [0, 1]) { const cx = sd ? 612 : 470; X.beginPath(); X.moveTo(cx - 18, 86); X.lineTo(cx + 18, 86); X.quadraticCurveTo(cx + (sd ? 8 : 26), 170, cx + (sd ? 14 : 4), 236); X.lineTo(cx - (sd ? 4 : 14), 236); X.quadraticCurveTo(cx - (sd ? 26 : 8), 170, cx - 18, 86); X.closePath(); ink('#ff8fb6', 3.5); }
  rr(452, 78, 178, 12, 6); ink('#c98443', 3);
  // the TV on its cabinet (left), grandma's armchair faces it
  rr(10, 318, 104, 76, 6); ink('#9a5f34', 4); X.fillStyle = '#7a4524'; X.fillRect(18, 344, 88, 4); el(62, 370, 5, 5); X.fillStyle = '#ffd23f'; X.fill();
  rr(14, 236, 96, 82, 12); ink('#6b6680', 4); rr(24, 246, 64, 60, 10); ink('#2a2340', 3); rr(92, 252, 12, 46, 5); ink('#4a4558', 2.5);
  line([[50, 236], [30, 202]], 3, '#c9ced6'); line([[62, 236], [86, 198]], 3, '#c9ced6');
  // the counter with the stove, next to the fridge
  rr(452, 300, 194, 96, 4); ink('#f2f0ff', 4); X.fillStyle = '#d9d4ee'; X.fillRect(452, 300, 194, 10);
  for (const dx of [470, 552]) { rr(dx, 322, 72, 60, 5); ink('#e6e2f7', 3); rr(dx + 26, 332, 20, 6, 3); ink('#9a96b0', 2); }
  rr(446, 288, 206, 16, 5); ink('#ff9a4d', 4);
  for (const kx of [500, KTX]) { el(kx, 290, 34, 6); ink('#3b3550', 3); }
  X = old; return cv2;
}

/* ───────────── live bits of the room ───────────── */
function tvScreen(T) {                               // a telenovela: two faces about to kiss, hearts
  X.save(); rr(24, 246, 64, 60, 10); X.clip(); X.fillStyle = '#ff9ac2'; X.fillRect(20, 240, 70, 70);
  X.fillStyle = 'rgba(255,255,255,.12)'; X.fillRect(20, 240 + ((T * 40) % 70), 70, 4);
  const k = Math.sin(T * 1.2) * 3; el(42 + k, 284, 11, 13); ink('#ffd2b3', 2); el(70 - k, 284, 11, 13); ink('#e9a98a', 2);
  X.fillStyle = '#5a3b2e'; el(42 + k, 274, 12, 6); X.fill(); el(70 - k, 274, 12, 6); X.fill();
  X.globalAlpha = .5 + .5 * Math.sin(T * 5); star(56, 258, 6, 3, 5, 0, '#ff4d6d', 0); X.globalAlpha = 1;
  X.restore(); X.fillStyle = 'rgba(255,255,255,.22)'; el(38, 258, 10, 4, -.4); X.fill();
}
function cat(T) {                                    // a fat cat asleep on the TV, its tail swings
  const br = 1 + Math.sin(T * 2) * .04;
  X.save(); X.translate(60, 236);
  X.save(); X.rotate(Math.sin(T * 1.6) * .25); line([[30, -6], [44, 14], [40, 34]], 6, '#ff9f1c'); X.restore();
  X.save(); X.scale(1, br); el(0, -16, 36, 18); ink('#ff9f1c', 3.5); X.fillStyle = '#ffbe5c'; el(-6, -22, 20, 7); X.fill(); X.restore();
  el(-26, -24, 15, 13); ink('#ff9f1c', 3);
  for (const sd of [-1, 1]) { X.beginPath(); X.moveTo(-26 + sd * 12, -32); X.lineTo(-26 + sd * 6, -46); X.lineTo(-26 + sd * 1, -34); X.closePath(); ink('#ff9f1c', 2.5); }
  X.strokeStyle = INK; X.lineWidth = 2.5; for (const sd of [-1, 1]) { X.beginPath(); X.moveTo(-26 + sd * 6 - 3, -24); X.quadraticCurveTo(-26 + sd * 6, -21, -26 + sd * 6 + 3, -24); X.stroke(); }
  X.restore();
  const k = (T * .7) % 1; X.globalAlpha = Math.sin(k * Math.PI); txt('z', 30 + k * 16, 196 - k * 26, 16 + k * 8, '#fff'); X.globalAlpha = 1;
}
/* grandpa's portrait (the background gag: his eyes follow the kids) */
function portrait(T, ex) {
  const x = 386, y = 108; rr(x - 46, y, 92, 110, 8); ink('#d9a43a', 5); rr(x - 36, y + 10, 72, 90, 4); ink('#5a8f7a', 3);
  el(x, y + 66, 22, 26); ink(SKIN, 3); X.fillStyle = '#fff'; el(x, y + 86, 16, 10); X.fill();          // face + big white moustache
  X.fillStyle = '#fff'; for (const sd of [-1, 1]) { el(x + sd * 10, y + 80, 12, 6, sd * .3); X.fill(); }
  X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); X.moveTo(x - 18, y + 80); X.quadraticCurveTo(x, y + 74, x + 18, y + 80); X.stroke();
  for (const sd of [-1, 1]) { el(x + sd * 9, y + 60, 6, 6); ink('#fff', 2); X.fillStyle = INK; el(x + sd * 9 + ex * 3.5, y + 61, 2.6, 3); X.fill(); }
  X.fillStyle = '#3b3550'; rr(x - 22, y + 30, 44, 14, 4); X.fill(); rr(x - 14, y + 18, 28, 16, 5); X.fill();   // a little bowler hat
}
/* the cuckoo clock (rare variant: the bird is a tiny grandma) */
function cuckoo(T, tiny) {
  const x = 340, y = 236;
  X.save(); X.translate(x, y); X.rotate(Math.sin(T * 3.2) * .3); line([[0, 0], [0, 44]], 3, '#d9a43a'); X.beginPath(); X.arc(0, 50, 9, 0, TAU); ink('#ffd23f', 3); X.restore();
  X.beginPath(); X.moveTo(x - 34, y - 52); X.lineTo(x, y - 82); X.lineTo(x + 34, y - 52); X.closePath(); ink('#7a4524', 4);
  rr(x - 28, y - 56, 56, 58, 4); ink('#a5622c', 4);
  X.beginPath(); X.arc(x, y - 22, 17, 0, TAU); ink('#fff8e6', 3);
  X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(x, y - 22); X.lineTo(x + Math.cos(T * .5) * 11, y - 22 + Math.sin(T * .5) * 11); X.moveTo(x, y - 22); X.lineTo(x, y - 33); X.stroke();
  rr(x - 9, y - 66, 18, 14, 3); ink('#3b2a22', 3);
  if (tiny) { X.save(); X.translate(x, y - 64); X.scale(.16, .16); grannyHead(0, 0, 1, Math.PI, { t: T, mood: 'stare' }); X.restore(); }
}

/* the fridge: open 0..1 swings the door (hinge on the right); inside, grandma with the cake */
function fridge(T, open, rk) {
  const x = FRX, y = FRY, w = FRW, h = FRH;
  X.save(); X.fillStyle = 'rgba(20,16,28,.25)'; el(x + w / 2, FLOOR + 8, w * .6, 8); X.fill(); X.restore();
  // inside (only when open)
  if (open > .02) {
    rr(x, y, w, h, 14); ink('#dff6ff', 5);
    X.save(); rr(x + 8, y + 8, w - 16, h - 16, 10); X.clip();
    const gl = X.createRadialGradient(x + w / 2, y + 60, 10, x + w / 2, y + 120, 200); gl.addColorStop(0, '#ffffff'); gl.addColorStop(1, '#a9e6ff'); X.fillStyle = gl; X.fillRect(x, y, w, h);
    X.fillStyle = '#7fc8e8'; for (const sy of [y + 96, y + 196]) X.fillRect(x, sy, w, 6);
    // a milk carton and a jelly on the shelves
    rr(x + 92, y + 52, 26, 44, 3); ink('#fff', 2.5); X.fillStyle = '#4db8ff'; X.fillRect(x + 92, y + 70, 26, 10);
    el(x + 30, y + 186, 18, 10); ink('#ff4d6d', 2.5);
    // grandma squeezed in: cardigan, cake on a plate, a fork, frost on her nose
    const bob = Math.sin(T * 10) * 2;
    X.save(); X.translate(x + w / 2 - 6, y + 168 + bob);
    el(0, 40, 52, 46); ink(CARD, 4); X.fillStyle = CARD2; el(0, 70, 46, 14); X.fill();
    for (let i = 0; i < 3; i++) { el(0, 16 + i * 18, 4, 4); ink('#fff', 1.5); }
    grannyHead(0, -24, .86, Math.PI, { t: T, mood: 'cake', frost: true });
    X.restore();
    X.save(); X.translate(x + w / 2 + 26, y + 222 + bob);
    el(0, 6, 34, 8); ink('#fff', 3);
    X.beginPath(); X.moveTo(-24, 2); X.lineTo(22, 2); X.lineTo(22, -22); X.lineTo(-10, -26); X.closePath(); ink('#fff1c9', 3);
    X.fillStyle = '#ff5f9e'; X.fillRect(-24, -10, 46, 5); X.beginPath(); X.moveTo(-26, -20); X.lineTo(24, -22); X.lineTo(24, -28); X.lineTo(-10, -32); X.closePath(); ink('#ff8fc4', 3);
    X.beginPath(); X.arc(6, -34, 6, 0, TAU); ink('#ff2f4f', 2.5);
    X.restore();
    X.save(); X.translate(x + w / 2 - 34, y + 160 + bob); X.rotate(-.6 + Math.sin(T * 14) * .3); line([[0, 0], [0, -34]], 3, '#c9ced6'); line([[-5, -34], [-5, -44]], 1.5, '#c9ced6'); line([[5, -34], [5, -44]], 1.5, '#c9ced6'); X.restore();
    // cold mist
    for (let i = 0; i < 3; i++) { const k = (T * .9 + i / 3) % 1; puff(x + 10 + i * 40, y + h - 20 - k * 20, 10 + k * 8, (1 - k) * .7); }
    X.restore();
    rr(x, y, w, h, 14); X.lineWidth = 8; X.strokeStyle = INK; X.stroke();
  }
  // the door: hinge on the right edge, squashes towards it as it swings open (we then see its inside face)
  const sx = Math.cos(open * Math.PI * .92), dw = w * Math.abs(sx), dx = x + w - dw;
  if (sx > 0) {
    rr(dx, y, dw, h, 14); ink('#f4f8ff', 5); X.save(); rr(dx, y, dw, h, 14); X.clip(); X.fillStyle = '#dfe6f4'; X.fillRect(dx, y, dw * .2, h); X.fillStyle = 'rgba(255,255,255,.7)'; X.fillRect(dx + dw * .7, y + 10, dw * .1, h - 20); X.restore();
    X.lineWidth = 6; X.strokeStyle = INK; X.beginPath(); X.moveTo(dx + 4, y + 102); X.lineTo(dx + dw - 4, y + 102); X.stroke();
    rr(dx + 14 * sx, y + 30, 10 * sx, 54, 4); ink('#c9ced6', 3); rr(dx + 14 * sx, y + 120, 10 * sx, 60, 4); ink('#c9ced6', 3);
    if (sx > .5) {                                   // magnets: a drawing of the cake (with a heart), a "NO!" note in grandma's hand
      X.save(); X.translate(dx + dw * .6, y + 160); X.scale(sx, 1); X.rotate(.06); rr(-30, -26, 60, 56, 3); ink('#fff', 3);
      X.beginPath(); X.moveTo(-18, 14); X.lineTo(18, 14); X.lineTo(18, -2); X.lineTo(-18, 2); X.closePath(); ink('#ffe08a', 2); X.fillStyle = '#ff5f9e'; X.fillRect(-18, 3, 36, 3); el(0, -8, 5, 5); ink('#ff2f4f', 2);
      el(0, -26, 5, 5); ink('#ff4d4d', 2); X.restore();
      X.save(); X.translate(dx + dw * .55, y + 52); X.scale(sx, 1); X.rotate(-.08); rr(-24, -18, 48, 36, 3); ink('#fff59a', 3); txt('NO!', 0, 1, 18, '#ff4d4d'); el(0, -18, 4, 4); ink('#4db8ff', 2); X.restore();
    }
  } else {
    const iw = w * .3 * Math.abs(sx) + 10, ix = x + w;
    rr(ix - 2, y, iw, h, 10); ink('#e6edf7', 5);
    X.fillStyle = '#c9d6ea'; for (const sy of [y + 60, y + 150, y + 230]) X.fillRect(ix + 2, sy, iw - 8, 6);
    if (rk > .4) { el(ix + iw / 2, y + 50, 6, 10); ink('#ffd23f', 2); }
  }
}

/* cosmetic randomness (particles only): its own generator, so the seeded level never depends on effects */
let CS = 11; const cr = () => (CS = CS * 16807 % 2147483647) / 2147483647;
/* window focus: a lost keyup / pointerup (Alt-Tab, app switch) must never leave a kid tiptoeing on its own */
let FOCUSN = 0;
try { addEventListener('blur', () => FOCUSN++); document.addEventListener('visibilitychange', () => FOCUSN++); } catch (e) { /* headless */ }

/* ═════════ the game ═════════ */
function duGranny(sp, D) {
  D = D || DUO.SOLO; const R = mkR(), role = D.role, judge = role === 0, TS = Math.sqrt(sp);
  const SPEED = 64 * TS;                               // px/s while tiptoeing: 5 s of walking at speed 1 (bots finish with ~2.5-3.5 s to spare)
  /* the schedule, built from the seed in the same order on both screens. 3 real looks; each one is announced to ONE kid
     (both kids get at least one); gaps may hold a false alarm (private) or a twitch (shared) */
  const who = [0, 1, R() < .5 ? 0 : 1]; for (let i = 2; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [who[i], who[j]] = [who[j], who[i]]; }
  const looks = [], fakes = [], RT = Math.sqrt(TS);   // everything speeds up with the round, the warning lead only half as much (it has to cover a relay)
  const WHIPd = WHIP / TS, BACKd = BACK / TS, FAKEd = FAKE / TS, TWd = TWITCH / TS;
  let tt = (2.3 + R() * .4) / TS, prevEnd = .3 / TS;
  for (let i = 0; i < 3; i++) {
    const lead = (1.45 + R() * .2) / RT, hold = (.75 + R() * .3) / TS, gap = (1.25 + R() * .4) / TS, fk = R(), fw = R(), fat = R();
    // a fake-out in the gap before this look. A false alarm must end a full second before the real warning (a kid who is
    // already standing still when the real one comes cannot warn its friend by freezing); a short gap only gets a twitch
    // (never before the first real look: the first time a kid sees its tell, it must be the truth)
    const room = tt - 1.0 / RT - FAKEd - (prevEnd + .3 / TS);
    if (i > 0 && room >= 0) fakes.push({ at: prevEnd + .3 / TS + fat * room, who: fw < .5 ? 0 : 1, kind: 'tell' });
    else if (fk < .6 && tt - prevEnd >= 1.2 / TS) fakes.push({ at: prevEnd + .3 / TS + fat * (tt - prevEnd - .9 / TS), who: -1, kind: 'twitch' });
    const e = { tell: tt, whip: tt + lead, look: tt + lead + WHIPd, end: tt + lead + WHIPd + hold, who: who[i] };
    e.back = e.end + BACKd; looks.push(e); prevEnd = e.back; tt = e.back + gap;
  }
  const rare = R() < .125;                             // 1 in 8: the cuckoo is a tiny grandma

  const kids = [0, 1].map(r => ({ x: X0, m: false, in: false, inAt: -9, caught: false, stopAt: -9, step: 0 }));
  const mk = kids[role], fr = kids[1 - role], frX = track();
  let held = 0, fN = FOCUSN, seeded = false; const kHeld = new Set();
  let lastSend = -9, pendingK = false, sentX = -1, sentM = -1, caughtAt = -1, caughtBy = -1, resAt = -1, ending = null, waitIn = -1, tickAt = 0, stepAt = 0;
  let lastPhase = 'idle', frStopPop = -9, tellSnd = false, aha = false, poofed = false, opened = false, nomAt = -9;
  const HKEYS = new Set(['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyD']);
  const myCol = () => { try { const m = typeof me === 'function' && me(); return (m && okHex(m.color) && m.color) || '#FFC93C'; } catch (e) { return '#FFC93C'; } };
  const pCol = () => (D.partner && okHex(D.partner.color) && D.partner.color) || '#6EA8FE';
  const colOf = r => r === role ? myCol() : pCol();

  /* where grandma is in her routine at time c: phase + how far her head has turned (0 = away, 1 = facing the room) */
  function phase(c) {
    for (const e of looks) {
      if (c < e.whip || c >= e.back) continue;
      if (c < e.look) return { p: 'whip', k: ease((c - e.whip) / WHIPd), e };
      if (c < e.end) return { p: 'look', k: 1, e };
      return { p: 'back', k: 1 - ease((c - e.end) / BACKd), e };
    }
    for (const f of fakes) if (f.kind === 'twitch' && c >= f.at && c < f.at + TWd) return { p: 'twitch', k: .16 * Math.sin((c - f.at) / TWd * Math.PI), e: null };
    return { p: 'idle', k: 0, e: null };
  }
  /* the early warning that role r sees at time c (true for a real look announced to r, or for r's false alarm) */
  function tellOf(r, c) {
    for (const e of looks) if (e.who === r && c >= e.tell && c < e.end) return Math.min(1, (c - e.tell) / .25);
    for (const f of fakes) if (f.kind === 'tell' && f.who === r && c >= f.at && c < f.at + FAKEd) return Math.min(1, (c - f.at) / .25, (f.at + FAKEd - c) / .15);
    return 0;
  }
  const holding = () => held > 0 || kHeld.size > 0;
  const canMove = () => !g.result && !ending && caughtAt < 0 && !mk.in && g.c > .05;
  function sendK(force) {                              // ≤ 10/s; a start/stop goes out at once, but never faster than 20/s (a masher)
    const x = Math.round(mk.x), m = mk.m ? 1 : 0;
    if (x === sentX && m === sentM) { pendingK = false; return; }
    if (g.c - lastSend < (force || pendingK ? .05 : .1)) { if (force) pendingK = true; return; }
    sentX = x; sentM = m; lastSend = g.c; pendingK = false; D.send('k', [x, m], true);
  }
  function spotted(r, x) {                             // grandma saw kid r (mine: judged here; the friend's: it told me)
    if (caughtAt >= 0) return;
    caughtAt = g.c; caughtBy = r; if (x !== undefined) { kids[r].x = x; }
    kids[r].caught = true;
    snd(1046, .07, 'square', .06); snd(784, .12, 'square', .06, .07); shake(7, .3);   // "AHA!"
  }
  function lose() { if (!ending) ending = { res: 'lose', at: g.c + .3 }; }

  const g = {
    c: 0, dur: 15, pts: 0,
    cmd: 'SNEAK!', roleLabel: judge ? 'NEEDLE SPY' : 'KETTLE SPY',
    hint: judge ? 'HOLD CLICK / SPACE TO SNEAK - FREEZE WHEN HER NEEDLES STOP!' : 'HOLD CLICK / SPACE TO SNEAK - FREEZE WHEN SHE PEEKS IN THE KETTLE!',
    thint: judge ? 'HOLD TO SNEAK - FREEZE WHEN HER NEEDLES STOP!' : 'HOLD TO SNEAK - FREEZE WHEN SHE PEEKS IN THE KETTLE!',
    update(dt) {
      g.c += dt; const c = g.c;
      if (g.result && resAt < 0) { resAt = c; if (g.result === 'lose' && caughtAt < 0) { caughtAt = c; caughtBy = -1; } }
      // input: lost focus drops every hold; a press held through the intro countdown counts
      if (FOCUSN !== fN || (typeof document !== 'undefined' && document.hidden)) { fN = FOCUSN; held = 0; kHeld.clear(); seeded = false; }
      const pr = typeof pressing !== 'undefined' ? pressing : null;
      if (c < .3 && pr && held === 0) { held = 1; seeded = true; } else if (seeded && pr === false) { held = Math.max(0, held - 1); seeded = false; }
      // my kid: tiptoe while held
      const wasM = mk.m;
      mk.m = canMove() && holding();
      if (mk.m) {
        mk.x = Math.min(GOAL, mk.x + SPEED * dt); mk.step += dt;
        if (c - stepAt > .26 / TS) { stepAt = c; snd(1400 + cr() * 300, .025, 'triangle', .025); }
        if (mk.x >= GOAL) { mk.in = true; mk.m = false; mk.inAt = c; D.send('in', { at: Math.round(c * 100) / 100 }); snd(660, .08, 'triangle', .05); snd(990, .1, 'triangle', .05, .08); }
      }
      if (wasM && !mk.m) mk.stopAt = c;
      sendK(mk.m !== wasM);
      // grandma (same on both screens): sounds on the whip, judge MY kid only
      const ph = phase(c);
      if (ph.p !== lastPhase) {
        if (ph.p === 'whip' && caughtAt < 0 && !g.result) { sfx.whoosh(false); snd(220, .14, 'sawtooth', .04, .05, 330); }      // "HM?"
        if (ph.p === 'twitch' && caughtAt < 0) snd(330, .07, 'triangle', .04, 0, 380);
        lastPhase = ph.p;
      }
      const myTell = tellOf(role, c) > 0;
      if (myTell && !tellSnd && caughtAt < 0) { tellSnd = true; if (role === 1) snd(1760, .5, 'sine', .018, 0, 2300); }   // the kettle starts to whistle
      if (!myTell) tellSnd = false;
      if (role === 0 && !myTell && caughtAt < 0 && !g.result && c - tickAt > .22) { tickAt = c; snd(2600, .012, 'square', .012); }   // click, click... (silence is the tell)
      if (ph.p === 'look' && c >= ph.e.look + GRACE && mk.m && caughtAt < 0 && !ending && !g.result) {
        spotted(role, mk.x); mk.m = false; D.send('caught', { x: Math.round(mk.x) }); if (judge) lose();
      }
      // the judge: verdict
      if (judge && !g.result) {
        if (!ending && caughtAt < 0 && mk.in && fr.in) ending = { res: 'win', at: c + .05 };
        if (!ending && c >= g.limit) {
          // the friend may be about to arrive: its 'in' could be on the way. Wait up to .25 s for one stamped before the limit
          if (mk.in && !fr.in && fr.x > GOAL - SPEED * .4 && caughtAt < 0) { if (waitIn < 0) waitIn = c; if (c - waitIn > .25) ending = { res: 'lose', at: c }; }
          else ending = { res: 'lose', at: c };
        }
        if (ending && c >= ending.at) g.finish(ending.res);
      }
      // the gag clock: poof into gnomes, fridge opening
      if (caughtAt >= 0 && !aha) { aha = true; for (let i = 0; i < 4; i++) snd(i % 2 ? 392 : 466, .16, 'sine', .05, .12 + i * .17, i % 2 ? 330 : 392); }   // the owl's "hoo-hoo"
      if (caughtAt >= 0 && !poofed && c - caughtAt > .3) { poofed = true; noise(.3, .09, 2000, 300, 'bandpass'); sfx.pop(); kids.forEach((k, r) => burst(kidX(r), LANE[r] - 30, '#f4f1ff', 10)); }
      if (g.result === 'win' && !opened && c - resAt > .05) { opened = true; snd(140, .3, 'sawtooth', .04, 0, 90); noise(.4, .05, 1200, 400, 'bandpass'); }
      if (g.result === 'win' && c - nomAt > .2 && c - resAt > .35 && c - resAt < 1.2) { nomAt = c; snd(180 + cr() * 60, .06, 'square', .05, 0, 120); }
      // remote kid: position snapshots, rendered LAG behind; stop flag as received
      const rx = frX.at(); if (rx !== null && !fr.caught && !fr.in) fr.x = rx;
    },
    msg(type, d) {
      if (type === 'k' && Array.isArray(d)) {
        const m = !!d[1]; if (fr.m && !m && !fr.in && caughtAt < 0) { fr.stopAt = g.c; frStopPop = g.c; }
        fr.m = m; frX.push(clamp(+d[0] || X0, X0, GOAL)); if (m) fr.step += .1;
      } else if (type === 'in') {
        if (fr.in) return; fr.in = true; fr.inAt = g.c; fr.m = false; fr.x = GOAL;
        if (judge && g.c >= g.limit && d && d.at > g.limit + .05) ending = ending || { res: 'lose', at: g.c };
      } else if (type === 'caught') {
        fr.m = false; spotted(1 - role, d && d.x !== undefined ? clamp(+d.x, X0, GOAL) : fr.x);
        if (judge) lose();
      }
    },
    hold(on) { held = on ? held + 1 : Math.max(0, held - 1); if (!on) seeded = false; },
    down() { g.hold(true); },
    up() { g.hold(false); },
    key(e) { if (e.code === 'KeyP' || e.code === 'KeyM' || e.code === 'Escape') return; if (HKEYS.has(e.code)) kHeld.add(e.code); },
    keyup(e) { kHeld.delete(e.code); },
    draw() {
      const T = g.c, ph = phase(T), won = g.result === 'win', rk = resAt >= 0 ? T - resAt : -1, ck = caughtAt >= 0 ? T - caughtAt : -1;
      if (!BG) BG = buildBg(); X = ctx;
      X.drawImage(BG, 0, 0);
      tvScreen(T); cat(T);
      const nearest = Math.max(kids[0].x, kids[1].x);
      portrait(T, clamp((nearest - 386) / 200, -1, 1)); cuckoo(T, rare);
      // the kettle on the stove: its reflection is my tell (kettle spy), steam on the other screen
      const kt = role === 1 ? tellOf(1, T) : 0;
      X.save(); X.translate(KTX, KTY - 6); X.scale(1.3, 1.3); kettle(0, 0, T, role === 1 ? kt : 0, role !== 1, kt); X.restore();
      if (role === 1 && kt > 0 && caughtAt < 0) { X.globalAlpha = kt; for (let i = 0; i < 3; i++) { const a = -1.9 + i * .5; X.strokeStyle = '#fff'; X.lineWidth = 4; X.beginPath(); X.moveTo(KTX + Math.cos(a) * 64, KTY - 46 + Math.sin(a) * 64); X.lineTo(KTX + Math.cos(a) * 82, KTY - 46 + Math.sin(a) * 82); X.stroke(); } X.globalAlpha = 1; }
      fridge(T, won ? ease(rk / .3) : 0, rk);
      // the vision cone (behind the kids): grows on the whip, red when someone is caught
      let turnK = ph.k, th = Math.PI * turnK;
      if (ck >= 0) th = Math.PI + TAU * 3 * ease(Math.min(ck, .9) / .9);                       // the owl spin: 3 whole turns, ends facing the room
      if (won) th = 0;
      if (ck >= 0 || (!won && (ph.p === 'whip' || ph.p === 'look' || ph.p === 'back'))) {
        const a = ck >= 0 ? 1 : turnK;
        X.save(); X.beginPath(); X.moveTo(HX + 30, HY - 4); X.lineTo(W + 20, 250 - 40 * a); X.lineTo(W + 20, 560); X.lineTo(HX + 120, 552); X.closePath();
        X.globalAlpha = .3 * a; X.fillStyle = ck >= 0 ? '#ff4d4d' : '#fff27a'; X.fill(); X.globalAlpha = .55 * a; X.setLineDash([14, 10]); X.lineDashOffset = -T * 60; X.lineWidth = 4; X.strokeStyle = '#fff'; X.stroke(); X.setLineDash([]); X.restore();
      }
      // the armchair (seen from behind) + grandma's head over it
      chair(T, ph, ck, won, rk, th);
      // the kids, back lane first
      for (const r of [0, 1]) drawKid(r, T, ph, ck, won, rk);
      // my early warning, close to where it shows
      if (role === 0 && caughtAt < 0 && !g.result && tellOf(0, T) > 0 && Math.sin(T * 20) > 0) { txt('!', 104, 196, 30, '#ffe14d'); }
      // feedback
      if (ck >= 0) badge(caughtBy < 0 ? 'TOO SLOW!' : 'I SEE YOU!', 470, 160, 34, '#e8434f', '#fff', ck < .25 ? outBack(ck / .25) : 1, -.06);
      if (won && rk > .35) badge('HI, DEARS!', 520, 92, 30, '#ff8fb6', '#fff', outBack((rk - .35) / .25), .05);
      if (frStopPop > 0 && T - frStopPop < .7 && caughtAt < 0 && !fr.in) { const k = (T - frStopPop) / .7; X.globalAlpha = 1 - k * k; badge('!', fr.x + 56, LANE[1 - role] - 96 - k * 10, 24, '#ffe14d', INK, outBack(k * 3), 0); X.globalAlpha = 1; }
      if (T < 2.6 && caughtAt < 0) {                  // where to look, at the start
        X.globalAlpha = clamp((2.6 - T) / .4, 0, 1);
        if (role === 0) { badge('WATCH HER NEEDLES', 118, 172, 16, '#3a3550', '#fff', 1, -.04); }
        else badge('WATCH THE KETTLE', KTX - 30, 176, 16, '#3a3550', '#fff', 1, .04);
        X.globalAlpha = 1;
      }
      // my control
      plate(T, ph);
      vignette(.22);
    },
  };
  function chair(T, ph, ck, won, rk, th) {
    const cx = 196;
    // grandma's shoulders (pink cardigan) show above the backrest; her head turns on top
    el(cx, 256, 64, 30); ink(CARD, 4); X.fillStyle = CARD2; el(cx + 16, 268, 44, 14); X.fill();
    X.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { X.beginPath(); X.arc(cx - 26 + i * 13, 234, 7, 0, Math.PI); X.fill(); }   // lace collar
    const tw = ph.p === 'twitch' ? Math.sin((T * 40)) * .06 : 0;
    const ear = role === 0 && caughtAt < 0 ? tellOf(0, T) : 0;
    const mood = ck >= 0 ? 'aha' : 'stare';
    const flash = ck >= 0 && ck < .2 ? 1 - ck / .2 : 0;
    X.save(); X.translate(HX, HY + 10); X.rotate(tw + (ph.p === 'twitch' ? ph.k : 0)); X.translate(-HX, -HY - 10);
    if (won && rk > .3) {                            // the decoy: in the armchair, a mop wearing her glasses
      grannyHead(HX, HY, 1.1, 0, { t: T, mop: true });
    } else grannyHead(HX, HY - (ck >= 0 ? Math.sin(ck * 18) * 3 : 0), 1.1, th, { t: T, ear, mood, flash, look: 1 });
    X.restore();
    if (ck >= 0 && ck < 1) for (let i = 0; i < 3; i++) { const a = T * 14 + i * TAU / 3; X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = 9; X.beginPath(); X.arc(HX, HY, 66, a, a + .8); X.stroke(); X.strokeStyle = '#ffe14d'; X.lineWidth = 4; X.stroke(); }
    // the wingback chair from behind: tall back with wings, buttons, little legs
    const back = P(CHAIRP);
    cel(back, CHAIR, CHAIR2, -10, 0, 5);
    X.save(); X.clip(back); X.fillStyle = CHAIRL; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { el(150 + i * 46, 270 + j * 50, 5, 5); X.fill(); }
    X.strokeStyle = 'rgba(40,20,80,.3)'; X.lineWidth = 3; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { X.beginPath(); X.moveTo(150 + i * 46 - 18, 270 + j * 50); X.lineTo(150 + i * 46 - 6, 270 + j * 50); X.stroke(); }
    X.fillStyle = 'rgba(255,255,255,.15)'; X.fillRect(124, 240, 10, 140); X.restore();
    for (const lx of [126, 266]) { rr(lx - 7, 388, 14, 22, 4); ink('#7a4524', 3); }
    // the knitting pokes out on the left (needle spy), or the fern hides it (kettle spy)
    const knit = role === 0 && caughtAt < 0 && !won ? tellOf(0, T) === 0 : true;
    if (role === 0) { yarn(84, 420, T, knit && caughtAt < 0, 96, 300); knitting(92, 266, T, knit && caughtAt < 0 && !g.result); }
    else fern(92, 416, T);
  }
  const kidX = r => kids[r].in ? GOAL - (r === 0 ? 40 : 8) : kids[r].x;   // where kid r is drawn (by the fridge once in)
  function drawKid(r, T, ph, ck, won, rk) {
    const k = kids[r], y = LANE[r], col = colOf(r), mine = r === role;
    if (ck >= 0 && ck > .3) {                         // caught: both kids are garden gnomes now (one already at the fridge too)
      const gx = kidX(r); gnome(gx, y, .74, col, T, (ck - .3) / .25); puff(gx, y - 50, 26, 1 - (ck - .3) / .4); return;
    }
    if (k.in) {                                      // hiding by the fridge (on a win: jump in surprise)
      const hx = kidX(r), jump = won && rk > .3 ? Math.abs(Math.sin((rk - .3) * 9)) * 22 : 0;
      X.save(); X.translate(hx, y - jump); shadow(0, 0, 28, 6, .25);
      arms(KU, won ? -.5 : .2, won ? .5 : -.2, won ? 1 : .6, col);
      claude(0, 0, KU, { col, mood: won ? 'happy' : null });
      X.restore();
      if (won && rk > .3) txt('!!', hx, y - 74 - jump, 28, '#ffe14d');
      if (mine && T - k.inAt < 1.2 && !won) badge('SAFE!', hx, y - 86, 18, '#22a447', '#fff', outBack((T - k.inAt) / .25), 0);
      return;
    }
    const moving = k.m && ck < 0, bob = moving ? Math.abs(Math.sin(T * 12)) * 6 : 0, lean = moving ? .1 : 0;
    const look = ph.p === 'look' || ph.p === 'whip';
    X.save(); X.translate(k.x, y - bob); shadow(0, bob, 28, 6, .25); X.rotate(lean);
    if (moving) arms(KU, .8 + Math.sin(T * 12) * .15, 1.05 - Math.sin(T * 12) * .15, .8, col);       // sneaky hands out front
    else arms(KU, -.15, 1.45, 1, col);                                                                   // a statue pose
    claude(0, 0, KU, { col, mood: ck >= 0 && ck < .3 ? 'sad' : null });
    if (!moving) { X.fillStyle = INK; X.fillRect(-7, -20, 14, 3); }                                       // tight-lipped
    X.restore();
    if ((look || (mine && tellOf(role, T) > 0)) && !moving && ck < 0) sweat(k.x + 20, y - 50, 1, T + r);
    // the front kid's tag sits beside it (above it would land on the back kid's feet)
    const tag = r === 1 ? [k.x + 34, y - 40 - bob, 'left'] : [k.x, y - 70 - bob, false];
    if (mine) pill(tag[0], tag[1], 'YOU', col, tag[2]);
    else if (T < 2.6) pill(tag[0], tag[1], 'YOUR FRIEND', col, tag[2]);
  }
  function plate(T, ph) {
    const [x, y, w, h] = PLATE, done = !!(g.result || ending || caughtAt >= 0 || mk.in), hd = !done && holding();
    const danger = !done && (ph.p === 'whip' || ph.p === 'look');
    const col = done ? '#d3cfe0' : danger ? (hd ? '#ff4d5e' : '#ffd23f') : hd ? '#5CFF7A' : '#ffd23f';
    const dk = done ? '#8f88a6' : danger ? (hd ? '#b8283a' : '#c99512') : hd ? '#23a046' : '#c99512';
    const d = hd ? 3 : 8;
    if (done) X.globalAlpha = .8;
    rr(x, y + 8, w, h, 18); ink(dk, 4);
    rr(x, y + 8 - d, w, h, 18); ink(col, 0); X.fillStyle = 'rgba(255,255,255,.28)'; rr(x + 10, y + 12 - d, w - 20, 10, 5); X.fill();
    rr(x, y + 8 - d, w, h, 18); X.lineWidth = 4; X.strokeStyle = INK; X.stroke();
    // a tiny foot icon on the left
    X.save(); X.translate(x + 34, y + 30 - d + 8); X.rotate(-.3); el(0, 0, 9, 14); ink('#fff', 3); for (let i = 0; i < 4; i++) { el(-6 + i * 4, -16 - (i === 0 ? 2 : 0), 2.6, 3); ink('#fff', 1.5); } X.restore();
    const label = done ? (g.result === 'win' ? 'CAKE!' : caughtAt >= 0 ? 'CAUGHT!' : mk.in ? 'WAIT FOR YOUR FRIEND' : '...') : danger ? (hd ? 'FREEZE!' : 'DON\'T MOVE!') : hd ? 'SNEAKING...' : 'HOLD TO SNEAK';
    if (TOUCH || done) txt(label, x + w / 2 + 16, y + h / 2 + 8 - d + 1, 26, '#fff', 'center', w - 80);
    else { txt(label, x + w / 2 + 16, y + h / 2 - d - 1, 22, '#fff', 'center', w - 80); keyCap(x + w / 2 + 16, y + h / 2 + 20 - d, 'SPACE'); }
    X.globalAlpha = 1;
  }
  g.dbg = {
    looks, fakes,
    me: () => ({ x: mk.x, m: mk.m, in: mk.in }),
    friend: () => ({ x: fr.x, m: fr.m, in: fr.in }),              // as drawn: the friend's kid (stiff when it stops)
    tell: () => tellOf(role, g.c) > 0,                             // my own early warning (needles / kettle)
    phase: () => phase(g.c).p,                                     // what grandma's head is doing (both screens)
    caught: () => caughtAt >= 0,
  };
  wire(g, D, 0, sp, 'du_granny');
  return g;
}
reg('du_granny', duGranny, "GRANNY'S WATCHING"); REGMAP.du_granny.duo = true;

/* ───────────── intro card: what each role does (520×240 frame), a 4 s loop: sneak, the tell, freeze, she looks, sneak on ───────────── */
function demo(role, tm) {
  X = ctx; const u = tm % 4, tell = u > 1.3 && u < 3.1, look = u > 2.2 && u < 3.1, k = look ? ease((u - 2.2) / .15) : 0, moving = !tell;
  X.fillStyle = '#ffe0a8'; X.fillRect(0, 0, 520, 240); X.fillStyle = 'rgba(200,120,70,.16)'; for (let x = 0; x < 520; x += 40) X.fillRect(x, 0, 16, 170);
  X.fillStyle = '#b97a46'; X.fillRect(0, 170, 520, 70); X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(0, 170); X.lineTo(520, 170); X.stroke();
  if (look) { X.save(); X.globalAlpha = .25; X.fillStyle = '#fff27a'; X.beginPath(); X.moveTo(110, 70); X.lineTo(520, 120); X.lineTo(520, 240); X.lineTo(160, 240); X.closePath(); X.fill(); X.restore(); }
  // armchair + grandma
  X.save(); X.translate(10, -30); X.scale(.62, .62);
  grannyHead(HX, HY, 1, Math.PI * k, { t: tm, ear: role === 0 && tell ? 1 : 0, mood: 'stare' });
  cel(P(CHAIRP), CHAIR, CHAIR2, -10, 0, 5);
  if (role === 0) knitting(96, 244, tm, !tell);
  X.restore();
  if (role === 1) { X.save(); X.translate(440, 168); X.scale(.9, .9); kettle(0, 0, tm, tell ? Math.min(1, (u - 1.3) / .3) : 0, false, tell ? 1 : 0); X.restore(); }
  if (tell && Math.sin(tm * 20) > 0) txt('!', role === 0 ? 60 : 440, role === 0 ? 100 : 74, 30, '#ffe14d');
  // the kid: walks, stops on the tell
  const x = 230 + (u < 1.3 ? u : 1.3 + Math.max(0, u - 3.1)) * 40, bob = moving ? Math.abs(Math.sin(tm * 12)) * 5 : 0;
  X.save(); X.translate(x, 200 - bob);
  if (moving) arms(3.4, .8, 1.05, .8, '#FFC93C'); else arms(3.4, -.15, 1.45, 1, '#FFC93C');
  claude(0, 0, 3.4, { col: '#FFC93C' }); X.restore();
  demoFinger(x + 70, 226, moving, moving ? (tm * 1.8) % 1 : 0);
  txt(moving ? 'HOLD TO SNEAK' : 'FREEZE!', role === 0 ? 380 : 250, 30, 24, moving ? '#fff' : '#ff4d5e');
}
DUO.INFO.du_granny = [['NEEDLE SPY', 'NEEDLES STOP? FREEZE!', 'HOLD TO SNEAK'], ['KETTLE SPY', 'SHE PEEKS IN THE KETTLE? FREEZE!', 'HOLD TO SNEAK']];
DUO.DEMOS.du_granny = [tm => demo(0, tm), tm => demo(1, tm)];

})();
