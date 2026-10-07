'use strict';
/* BURGER boss (CUBE PARTY), after Smooth Moves' "Fresh off the Grill": stuff gets thrown onto a burger,
   grab it the instant the sesame TOP BUN lands. Too early (or on a look-alike decoy) loses, too late and a seagull steals it. */
(function () {
  const BUN = '#E8A54B', BUN2 = '#C9802F';
  const SIZE = { bottom: 30, patty: 24, cheese: 10, lettuce: 14, tomato: 12, sneaker: 34, duck: 42, bug: 30, keyboard: 18, hat: 44, ufo: 44, shell: 44, top: 46 };
  const DECOY = { hat: 'A HAT?!', ufo: 'A UFO?!', shell: 'A SHELL?!' };
  /* ── local DUO kit (draws on X so the same code paints the baked scene and the live frame) ── */
  let X = ctx;
  const MEMO = new Map(), M = (k, f) => { let v = MEMO.get(k); if (!v) MEMO.set(k, v = f()); return v; };
  const hs = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // decor randomness, never the game RNG
  const rrP = (x, y, w, h, r) => M('r' + [x, y, w, h, r], () => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; });
  const elP = (x, y, rx, ry, rot = 0) => M('e' + [x, y, rx, ry, rot], () => { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, 7); return p; });
  const polyP = (key, f) => M('p' + key, () => { const p = new Path2D(); f().forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); p.closePath(); return p; });
  const J = () => { X.lineJoin = 'round'; X.lineCap = 'round'; };
  const inkP = (p, fill, o = 4) => { J(); X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(p); X.fillStyle = fill; X.fill(p); };
  const celP = (p, base, shade, o = 4, dx = -4, dy = -5) => { J(); X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(p); X.fillStyle = shade; X.fill(p); X.save(); X.clip(p); X.translate(dx, dy); X.fillStyle = base; X.fill(p); X.restore(); };
  const glint = (x, y, rx, ry, rot = -.4, a = .5) => { X.fillStyle = 'rgba(255,255,255,' + a + ')'; X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, 7); X.fill(); };
  const dot = (x, y, r, fill, o = 3) => inkP(elP(x, y, r, r), fill, o);
  const line = (pts, col, w, ink = true) => { J(); X.beginPath(); pts.forEach((p, i) => i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1])); if (ink) { X.strokeStyle = INK; X.lineWidth = w + 6; X.stroke(); } X.strokeStyle = col; X.lineWidth = w; X.stroke(); };
  const mix = (a, b, k) => { const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16), f = s => Math.round(((A >> s & 255) * (1 - k) + (B >> s & 255) * k)); return '#' + ((1 << 24) | f(16) << 16 | f(8) << 8 | f(0)).toString(16).slice(1); };
  function eye(x, y, r, mood = 'idle', lx = 0, ly = 0, T = 0, k = 0) {   // sclera + pupil + highlight, blinks
    J(); X.strokeStyle = INK;
    if (mood === 'happy') { X.lineWidth = r * .55; X.beginPath(); X.arc(x, y + r * .35, r * .8, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); return; }
    if (mood === 'dead') { X.lineWidth = r * .5; X.beginPath(); X.moveTo(x - r * .8, y - r * .8); X.lineTo(x + r * .8, y + r * .8); X.moveTo(x + r * .8, y - r * .8); X.lineTo(x - r * .8, y + r * .8); X.stroke(); return; }
    if (Math.sin(T * 1.9 + k) > .985) { X.lineWidth = r * .5; X.beginPath(); X.moveTo(x - r * .8, y); X.lineTo(x + r * .8, y); X.stroke(); return; }
    const R = mood === 'panic' ? r * 1.3 : r, pr = R * (mood === 'panic' ? .34 : .52);
    X.beginPath(); X.ellipse(x, y, R, R * 1.08, 0, 0, 7); X.fillStyle = '#fff'; X.fill(); X.lineWidth = R * .28; X.stroke();
    const px = x + lx * R * .38, py = y + ly * R * .38; X.fillStyle = INK; X.beginPath(); X.arc(px, py, pr, 0, 7); X.fill();
    X.fillStyle = '#fff'; X.beginPath(); X.arc(px - pr * .35, py - pr * .4, pr * .35, 0, 7); X.fill();
  }
  function heart(x, y, s, col = '#ff5c8a') { const p = M('h' + s, () => { const q = new Path2D(); q.moveTo(0, s * .9); q.bezierCurveTo(-s * 1.5, -s * .2, -s * .6, -s * 1.2, 0, -s * .4); q.bezierCurveTo(s * .6, -s * 1.2, s * 1.5, -s * .2, 0, s * .9); return q; }); X.save(); X.translate(x, y); inkP(p, col, 2.5); glint(-s * .4, -s * .4, s * .22, s * .14, -.5, .6); X.restore(); }
  const domeD = h => M('d' + h, () => { const p = new Path2D(); p.moveTo(-78, 0); p.bezierCurveTo(-80, -h * 1.3, 80, -h * 1.3, 78, 0); p.closePath(); return p; });
  const SEEDS = [[-40, -26], [-14, -44], [12, -34], [36, -46], [50, -22], [-56, -14], [0, -18], [26, -14]];
  const bun = (h = 46, seeds = SEEDS) => { celP(domeD(h), BUN, BUN2, 4.5, -3, -8); glint(-30, -h * .8, 22, 7, -.3, .5);
    for (const [x, y] of seeds) { X.fillStyle = '#b98a45'; X.beginPath(); X.ellipse(x + 1, y + 2, 5, 3, .5, 0, 7); X.fill(); X.fillStyle = '#FFF6DC'; X.beginPath(); X.ellipse(x, y, 5, 3, .5, 0, 7); X.fill(); } };
  const pop = (a, d) => Math.max(0, Math.min(1, (a - d) * 7));   // decoy tells pop out a beat after landing
  /* every piece is drawn with (0,0) at its bottom centre, ~156px wide */
  const ART = {
    bottom() { celP(rrP(-76, -30, 152, 30, [6, 6, 14, 14]), BUN, BUN2, 4, 0, -7); glint(-40, -22, 28, 3.5, 0, .4); },
    patty() { celP(rrP(-80, -24, 160, 24, 12), '#7a4424', '#4a2713', 4, 0, -7); line([[-55, -17], [-41, -6]], '#3e1f0e', 4, false); for (let x = -27; x < 60; x += 28) line([[x, -17], [x + 14, -6]], '#3e1f0e', 4, false); glint(-40, -17, 28, 3, 0, .25); },
    cheese() { celP(polyP('ch', () => [[-84, -10], [84, -10], [84, 0], [62, 0], [56, 12], [48, 0], [0, 0], [-8, 14], [-16, 0], [-56, 0], [-62, 10], [-68, 0], [-84, 0]]), '#FFD84A', '#e0a418', 3.5, 0, -3); glint(-34, -6, 22, 2.5, 0, .55); },
    lettuce() { const p = polyP('lt', () => { const q = [[-86, 0]]; for (let x = -86; x <= 86; x += 12) q.push([x, -8 - (x / 12 & 1) * 6]); q.push([86, 0]); for (let x = 80; x > -86; x -= 16) q.push([x, 4 + (x / 16 & 1) * 4]); return q; });
      celP(p, '#6fd45e', '#3ea04a', 3.5, 0, -4); line([[-60, -3], [-30, -5], [-4, -3], [30, -5], [60, -3]], '#a6ec86', 2.5, false); },
    tomato() { for (const s of [-36, 36]) { celP(elP(s, -6, 42, 8), '#ff5648', '#c92f2a', 3.5, 0, -3); X.fillStyle = '#ffd1c4'; for (const d of [-14, 0, 14]) { X.beginPath(); X.roundRect(s + d - 3, -9, 6, 4, 2); X.fill(); } glint(s - 16, -9, 12, 2, 0, .5); } },
    sneaker() { celP(rrP(-62, -12, 128, 12, 5), '#fff', '#c9d0e0', 4, 0, -3);
      celP(polyP('sn', () => [[-62, -12], [-60, -30], [-14, -34], [6, -24], [56, -18], [66, -12]]), '#4DB8FF', '#2a82cc', 4, -3, -4);
      for (let x = -40; x < 0; x += 11) line([[x, -31], [x + 6, -22]], '#fff', 3, false); X.fillStyle = '#FFE14D'; X.beginPath(); X.arc(-44, -20, 4, 0, 7); X.fill(); glint(30, -20, 14, 3, -.15, .45); },
    duck() { const T = now; celP(elP(0, -16, 44, 16), '#FFE14D', '#e8b41c', 4, -3, -4); line([[-34, -18], [-10, -6], [6, -18]], '#e8b41c', 3, false);
      celP(elP(18, -34, 15, 13), '#FFE14D', '#e8b41c', 4, -2, -3); celP(polyP('dk', () => [[30, -36], [46, -32], [30, -28]]), '#FF8A2A', '#d9631a', 3, 0, -2);
      X.fillStyle = 'rgba(255,110,150,.6)'; X.beginPath(); X.ellipse(21, -29, 4, 2.6, 0, 0, 7); X.fill(); eye(21, -38, 4.2, 'idle', 1, .3, T, 2); glint(-24, -22, 14, 4, -.2, .5); },
    bug() {   // a bug on its back, legs flailing
      for (let i = 0; i < 6; i++) { const lx = -26 + i * 11; line([[lx, -20], [lx + Math.sin(now * 30 + i * 2) * 8, -44]], '#7a2a2a', 4); }
      celP(elP(0, -14, 48, 15), '#e8433a', '#b02a2a', 4, -3, -4); celP(elP(-52, -14, 12, 12), '#5a3a42', '#3a2630', 3.5, -2, -2);
      eye(-55, -17, 3.4, 'panic', .2, .3, now, 1); eye(-47, -17, 3.4, 'panic', .2, .3, now, 1);
      for (const x of [-22, 4, 28]) dot(x, -12, 4.5, INK, 0); glint(-14, -22, 18, 3, -.1, .45); },
    keyboard() { celP(rrP(-74, -18, 148, 18, 4), '#4a5060', '#2e323d', 3.5, 0, -4); X.fillStyle = '#e8e8f0'; for (let r = 0; r < 2; r++) for (let x = -66; x < 62; x += 14) { X.beginPath(); X.roundRect(x + r * 5, -15 + r * 7, 10, 5, 2); X.fill(); } },
    hat(a) {   // tell: a brim and a red band; tips itself after landing
      X.rotate(-pop(a, .12) * .12); celP(elP(0, -3, 104, 8), BUN2, '#9a5f1f', 4, 0, -2); bun(44, SEEDS.filter(s => s[1] < -24));
      X.save(); X.clip(domeD(44)); X.fillStyle = '#E8433A'; X.fillRect(-90, -19, 180, 11); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(-90, -19, 180, 3); X.restore(); J(); X.lineWidth = 9; X.strokeStyle = INK; X.stroke(domeD(44)); },
    ufo(a) {   // tell: a grey saucer rim; lights + antenna switch on and it hovers after landing
      const u = pop(a, .12); X.translate(0, -u * (10 + Math.sin(now * 7) * 4));
      if (u) { line([[0, -56], [0, -56 - 22 * u]], '#6f7890', 4); dot(0, -58 - 22 * u, 7 * u, '#FF4D9E', 3); }
      celP(elP(0, -4, 94, 9), '#9aa3b5', '#6f7890', 4, 0, -3); bun(44, SEEDS);
      for (const x of [-70, -35, 0, 35, 70]) dot(x, -4, 5, u ? ((now * 6 + x / 35) & 1 ? '#5CFF7A' : '#FFE14D') : '#5b6170', 2); },
    shell(a) {   // tell: plate lines instead of seeds; a turtle head and feet pop out after landing
      const u = pop(a, .15); if (u) { for (const x of [-50, 50]) celP(elP(x, -2, 14 * u, 9 * u), '#7BD88F', '#4aa863', 3.5, 0, -2); celP(elP(-80 - 14 * u, -14, 16 * u, 12 * u), '#7BD88F', '#4aa863', 3.5, -1, -2); X.fillStyle = INK; X.fillRect(-92 - 14 * u, -20, 5 * u, 5 * u); }
      celP(domeD(44), BUN, BUN2, 4.5, -3, -8); glint(-30, -35, 22, 7, -.3, .5); X.strokeStyle = BUN2; X.lineWidth = 4; X.lineJoin = 'round';
      for (const x of [-38, 0, 38]) { const y = -26 - (x ? 0 : 10); X.beginPath(); for (let i = 0; i < 6; i++) { const an = i * Math.PI / 3; X.lineTo(x + Math.cos(an) * 15, y + Math.sin(an) * 11); } X.closePath(); X.stroke(); } },
    top() { bun(46); }
  };
  const piece = (k, x, y, rot = 0, sq = 0, sc = 1, a = 0) => { X.save(); X.translate(x, y); X.rotate(rot); X.scale(sc * (1 + sq * .22), sc * (1 - sq * .3)); ART[k](a); X.restore(); };
  function gull(x, y, f, dir = 1, mood = 'thief', sc = 1.5, perch = false, T = 0) {   // a cheeky seagull, (x,y) = belly
    X.save(); X.translate(x, y); X.scale(dir * sc, sc); const w = Math.sin(f) * 26;
    if (perch) { for (const lx of [-6, 4]) { line([[lx, 6], [lx, 22]], '#FF8A2A', 3); line([[lx, 22], [lx + 7, 22]], '#FF8A2A', 3); } }
    else { inkP(polyP('gw1', () => [[-10, -14], [-60, -30], [-24, -6]]), '#c9d0dc', 3); }
    celP(elP(0, -10, 34, 18), '#fff', '#d3d9ea', 3.5, -3, -4);
    if (perch) celP(elP(-8, -10, 24, 11, .25), '#c9d0dc', '#9aa3b5', 3, -1, -2);
    else { inkP(polyP('gw' + Math.round(w), () => [[10, -14], [60, -30 - w], [24, -6]]), '#c9d0dc', 3); inkP(polyP('gw2' + Math.round(w), () => [[-10, -14], [-60, -30 - w], [-24, -6]]), '#c9d0dc', 3); }
    celP(elP(30, -26, 14, 12), '#fff', '#d3d9ea', 3.5, -2, -3);
    const open = mood === 'laugh' || mood === 'hungry' || mood === 'thief' ? 1 : 0, mv = open ? 5 + Math.sin(T * 14) * 2 : 0;
    inkP(polyP('gb' + Math.round(mv), () => [[40, -28], [62, -25 - mv * .3], [40, -23]]), '#FF8A2A', 3);
    inkP(polyP('gc' + Math.round(mv), () => [[40, -22 + mv * .2], [58, -20 + mv], [40, -17]]), '#e87420', 3);
    eye(34, -31, 4.4, mood === 'hungry' ? 'panic' : mood === 'laugh' ? 'happy' : 'idle', 1, mood === 'hungry' || mood === 'thief' ? .5 : .2, T, 3);
    if (mood === 'thief') line([[28, -38], [40, -33]], INK, 3.5, false);
    if (mood === 'cry') { line([[28, -33], [40, -38]], INK, 3.5, false); X.fillStyle = '#9fe3ff'; X.beginPath(); X.ellipse(36, -22 + (T * 18 % 14), 2.4, 3.4, 0, 0, 7); X.fill(); }
    X.restore();
  }
  /* menu boards on sticks: fries / soda / a winking cherry, no text */
  function poster(x, y, kind) {
    X.save(); X.translate(x, y); X.rotate(Math.sin(x) * .06);
    celP(rrP(-6, 80, 12, 140, 3), '#d9944f', '#a5622c', 3, -2, 0);
    const col = kind === 1 ? '#FF4D9E' : kind === 2 ? '#4DB8FF' : '#FFE14D';
    X.fillStyle = 'rgba(20,16,28,.28)'; X.beginPath(); X.roundRect(-58, -72, 124, 160, 14); X.fill();
    celP(rrP(-62, -80, 124, 160, 12), col, mix(col, '#14101c', .28), 4.5, -4, -5); inkP(rrP(-52, -70, 104, 140, 8), mix(col, '#ffffff', .18), 2.5);
    X.fillStyle = 'rgba(255,255,255,.28)'; for (let i = 0; i < 6; i++) { X.beginPath(); X.moveTo(0, 0); X.arc(0, 0, 66, i * 1.05, i * 1.05 + .3); X.fill(); }
    if (kind === 0) { for (let i = -2; i <= 2; i++) inkP(polyP('f' + i, () => [[i * 11 - 5, 6], [i * 13 - 4, -46 + Math.abs(i) * 6], [i * 13 + 6, -46 + Math.abs(i) * 6], [i * 11 + 5, 6]]), '#FFC93C', 3);
      celP(polyP('fc', () => [[-36, 0], [36, 0], [28, 52], [-28, 52]]), '#E8433A', '#b02a2a', 3.5, -3, 0); glint(-18, 20, 5, 12, .1, .5); }
    else if (kind === 1) { inkP(polyP('sd', () => [[-28, -30], [28, -30], [20, 56], [-20, 56]]), '#fff', 3.5); X.fillStyle = '#E8433A'; X.fillRect(-24, 0, 48, 14); inkP(elP(0, -32, 32, 9), '#fff', 3.5); line([[8, -34], [20, -62]], '#E8433A', 5); glint(-14, 24, 4, 14, 0, .6); }
    else { line([[0, -16], [10, -50], [26, -56]], '#3a7a2a', 5); celP(elP(0, 6, 30, 30), '#E8433A', '#b02a2a', 4.5, -4, -4); eye(-10, 0, 5, 'idle', 0, 0, 0, 0); line([[6, 2], [16, 0]], INK, 4, false); glint(-12, -10, 8, 4.5, -.5, .6); X.strokeStyle = INK; X.lineWidth = 3.5; X.beginPath(); X.arc(0, 14, 9, .2, Math.PI - .2); X.stroke(); }
    X.restore();
  }

  const CXB = 400;
  /* ── baked scene: a beach burger shack ── */
  let BG = null, BGW = 0, BGO = 0;
  const cloud = (x, y, s) => { X.save(); X.translate(x, y); X.scale(s, s); const p = M('cl', () => { const q = new Path2D(); for (const [cx, cy, r] of [[-30, 4, 18], [-8, -8, 24], [18, -2, 20], [38, 6, 15]]) { q.moveTo(cx + r, cy); q.arc(cx, cy, r, 0, 7); } return q; });
    J(); X.lineWidth = 6; X.strokeStyle = '#9cc6ef'; X.stroke(p); X.fillStyle = '#e4f5ff'; X.fill(p); glint(-12, -14, 16, 8, -.4, .9); X.restore(); };
  function palm(x, y, lean, s) {
    X.save(); X.translate(x, y); X.scale(s, s);
    const tx = lean * 70, ty = -150; line([[0, 0], [tx * .3, ty * .5], [tx, ty]], '#8a5a34', 11);
    for (let i = 1; i < 6; i++) { const u = i / 6.5; X.strokeStyle = 'rgba(20,16,28,.35)'; X.lineWidth = 3; X.beginPath(); X.moveTo(tx * u * .8 - 6, ty * u); X.lineTo(tx * u * .8 + 6, ty * u - 3); X.stroke(); }
    X.translate(tx, ty); for (let i = 0; i < 6; i++) { const an = -Math.PI * .5 + (i - 2.5) * .62; X.save(); X.rotate(an); celP(M('pl', () => { const q = new Path2D(); q.moveTo(0, 0); q.quadraticCurveTo(24, -30, 70, -6); q.quadraticCurveTo(30, -12, 0, 0); return q; }), '#3fb260', '#2f9a55', 3, 0, -3); X.restore(); }
    dot(-6, 6, 7, '#8a5a34', 2.5); dot(7, 8, 7, '#8a5a34', 2.5); X.restore();
  }
  function paintBack() {
    const L = -OX, Wd = VW;
    let g = X.createLinearGradient(0, 0, 0, 340); g.addColorStop(0, '#3fb0ff'); g.addColorStop(.55, '#8fdcff'); g.addColorStop(1, '#e6fbff'); X.fillStyle = g; X.fillRect(L, 0, Wd, 342);
    dot(560, 128, 30, '#ffd84a', 4); glint(550, 118, 12, 7, -.5, .7);
    // far island + sea
    X.fillStyle = '#a9dfc6'; X.beginPath(); X.moveTo(70, 336); X.quadraticCurveTo(130, 290, 200, 336); X.fill();
    X.fillStyle = '#8fd0b2'; X.beginPath(); X.moveTo(150, 336); X.quadraticCurveTo(210, 308, 270, 336); X.fill();
    g = X.createLinearGradient(0, 330, 0, 396); g.addColorStop(0, '#62d3f0'); g.addColorStop(1, '#2a8fcb'); X.fillStyle = g; X.fillRect(L, 330, Wd, 70);
    X.fillStyle = 'rgba(255,255,255,.7)'; X.fillRect(L, 330, Wd, 3);
    // sand with an inked coast line
    g = X.createLinearGradient(0, 394, 0, 510); g.addColorStop(0, '#f6dc9c'); g.addColorStop(1, '#e6bf74'); X.fillStyle = g; X.fillRect(L, 394, Wd, 120);
    X.fillStyle = INK; X.fillRect(L, 392, Wd, 4);
    X.fillStyle = 'rgba(255,255,255,.2)'; for (let i = -6; i < 24; i++) { X.beginPath(); X.moveTo(i * 60, 398); X.lineTo(i * 60 + 22, 398); X.lineTo(i * 60 - 40, 506); X.lineTo(i * 60 - 62, 506); X.fill(); }
    for (let i = 0; i < 26; i++) { const sx = L + 20 + hs(i) * (Wd - 40), sy = 410 + hs(i + 40) * 80; if (Math.abs(sx - 400) < 110 && sy > 420) continue; X.fillStyle = i % 3 ? '#d4a95e' : '#fff3d1'; X.beginPath(); X.ellipse(sx, sy, 5 + hs(i + 9) * 4, 3, 0, 0, 7); X.fill(); }
    // starfish
    X.save(); X.translate(210, 478); X.rotate(.4); const sf = new Path2D(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 6 : 17, an = i * Math.PI / 5; i ? sf.lineTo(Math.cos(an) * r, Math.sin(an) * r) : sf.moveTo(r, 0); } sf.closePath(); celP(sf, '#ff8a5c', '#d9603a', 2.5, -1.5, -1.5); X.restore();
  }
  function paintFront() {
    const L = -OX, Wd = VW;
    palm(240, 440, -.4, .9); palm(572, 440, .45, 1);
    for (const [px, kd] of [[120, 0], [680, 1], [-150, 2], [950, 2], [-420, 1], [1220, 0]]) if (px > -OX - 70 && px < W + OX + 70) poster(px, 290, kd);
    // counter: wooden top, striped awning-skirt front
    celP(rrP(L - 10, 504, Wd + 20, 20, 4), '#f2b878', '#d9944f', 4, 0, -5); glint(100, 509, 90, 2.5, 0, .5);
    for (let x = L - (L % 44) - 44, i = 0; x < W + OX; x += 44, i++) { const c = i & 1 ? '#fff4dc' : '#e8433a'; inkP(rrP(x, 524, 44, 90, [0, 0, 22, 22]), c, 3.5); }
    // props on the counter: ketchup + mustard, a service bell
    for (const [bx, c, c2] of [[142, '#e8433a', '#b02a2a'], [186, '#FFD84A', '#d9a416']]) { celP(rrP(bx - 14, 450, 28, 54, [10, 10, 5, 5]), c, c2, 3.5, -3, 0); celP(rrP(bx - 6, 438, 12, 14, 3), '#fff', '#c9d0e0', 3, -1, 0); inkP(rrP(bx - 10, 468, 20, 20, 4), '#fff4dc', 2.5); glint(bx - 8, 460, 3, 8, 0, .6); }
    celP(elP(300, 503, 24, 7), '#c9ced6', '#8f9cb3', 3.5, 0, -2);
    X.save(); X.translate(300, 500); celP(M('bell', () => { const q = new Path2D(); q.moveTo(-17, 0); q.bezierCurveTo(-17, -28, 17, -28, 17, 0); q.closePath(); return q; }), '#FFD84A', '#d9a416', 3.5, -3, -3); dot(0, -26, 4, '#c9ced6', 2.5); glint(-8, -14, 3, 7, .3, .6); X.restore();
    // plate
    X.fillStyle = 'rgba(20,16,28,.3)'; X.beginPath(); X.ellipse(CXB + 4, 516, 150, 14, 0, 0, 7); X.fill();
    celP(elP(CXB, 506, 136, 13), '#fff', '#c9d0e0', 4, 0, -3); inkP(elP(CXB, 504, 100, 7), '#e6e9f0', 2);
  }
  let FG = null;
  function miniBurger(x, y, s) {   // ticket icon
    X.save(); X.translate(x, y); X.scale(s, s);
    celP(rrP(-17, -5, 34, 7, [2, 2, 5, 5]), BUN, BUN2, 2.5, 0, -2); celP(rrP(-18, -11, 36, 7, 3.5), '#7a4424', '#4a2713', 2.5, 0, -2);
    celP(M('mb', () => { const q = new Path2D(); q.moveTo(-17, -11); q.bezierCurveTo(-18, -34, 18, -34, 17, -11); q.closePath(); return q; }), BUN, BUN2, 2.5, -2, -3);
    X.fillStyle = '#FFF6DC'; for (const [sx, sy] of [[-6, -22], [3, -26], [8, -19], [-1, -17]]) { X.beginPath(); X.ellipse(sx, sy, 2, 1.2, .5, 0, 7); X.fill(); } X.restore();
  }
  function splat(x, y, r) {   // ketchup splat on the counter
    const p = new Path2D(); for (let i = 0; i < 14; i++) { const an = i * Math.PI / 7, rr_ = r * (i % 2 ? .62 : 1) * (.8 + hs(i) * .4); const px = x + Math.cos(an) * rr_ * 1.5, py = y + Math.sin(an) * rr_ * .4; i ? p.lineTo(px, py) : p.moveTo(px, py); } p.closePath();
    celP(p, '#ff4d5e', '#b8283a', 3.5, -2, -2); glint(x - r * .5, y - 3, r * .3, 3, 0, .6);
  }
  function arms(cx, cy, u, r) {   // blocky arms, r: 0 hanging .. 1 straight up; drawn before claude()
    const ol = Math.max(3, u * .5), L = 3.3 * u, aw = 1.2 * u, hs_ = 2 * u, ang = (1 - r) * Math.PI * .85;
    for (const sx of [-1, 1]) { X.save(); X.translate(cx + sx * 6.6 * u, cy - 5.2 * u); X.rotate(sx * ang);
      X.fillStyle = INK; X.fillRect(-aw / 2 - ol, -L - ol, aw + ol * 2, L + ol * 2); X.fillRect(-hs_ / 2 - ol, -L - .35 * u - hs_ - ol, hs_ + ol * 2, hs_ + ol * 2);
      X.fillStyle = OR; X.fillRect(-aw / 2, -L, aw, L); X.fillRect(-hs_ / 2, -L - .35 * u - hs_, hs_, hs_); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-hs_ / 2, -L - .35 * u - hs_, hs_ * .45, hs_ * .4); X.restore(); }
  }
  function chefHat(x, y, rot) {   // paper chef hat sitting on Claude's head (eyes stay clear)
    X.save(); X.translate(x, y); X.rotate(rot);
    const puffs = [[-18, -20, 14], [0, -30, 18], [18, -20, 14]]; J(); X.strokeStyle = INK; X.lineWidth = 7;
    for (const [px, py, pr] of puffs) { X.beginPath(); X.arc(px, py, pr, 0, 7); X.stroke(); } X.fillStyle = '#fff'; for (const [px, py, pr] of puffs) { X.beginPath(); X.arc(px, py, pr, 0, 7); X.fill(); }
    X.fillStyle = '#dfe4f0'; for (const [px, py, pr] of puffs) { X.beginPath(); X.arc(px, py, pr, .2, 1.5); X.lineTo(px, py); X.fill(); }
    glint(-6, -36, 8, 5, -.4, .8); celP(rrP(-26, -14, 52, 16, 4), '#fff', '#c9d0e0', 3.5, -2, -3); X.fillStyle = '#E8433A'; X.fillRect(-24, -4, 48, 3);
    X.restore();
  }
  BOSSES.burger = function (sp, s) {
    const k = Math.min(sp, 1.3), win0 = .68 / Math.sqrt(Math.min(sp, 1.8));   // ~0.52 s at sp 1.7
    const CX = W / 2, BASE = 504, NEED = 3, SILLY = ['sneaker', 'duck', 'bug', 'keyboard'], DEC = shuffle(['hat', 'ufo', 'shell']);
    let round = 0, phase = 'drop', next = .5, queue = [], gaps = [], stack = [], fly = [], win = 0, wob = 0, served = 0, sv = null;
    let resT = 0, how = '', bites = 0, cl = { x: 650, hop: 0, hopIn: 0 }, tpop = 0, gl = null, debris = [], clock = 0, SC = 1.3, reacts = [];
    const H_ = () => stack.reduce((a, p) => a + SIZE[p.k], 0), TOPY = () => BASE - H_() * SC;   // SC zooms out as the stack grows
    /* plan all 3 burgers up front (random counts + random gaps, with suspense pauses), then squeeze the gaps
       so even a player who uses every grab window finishes before the fuse burns out */
    const plan = [0, 1, 2].map(r => {
      const food = shuffle(['patty', 'cheese', 'lettuce', 'tomato']).slice(0, (r < 2 ? 2 : 1) + (Math.random() * 2 | 0));
      const q = shuffle(food.concat(shuffle(SILLY.slice()).slice(0, 1 + (r === 2 && food.length < 2 ? 1 : 0))));
      DEC.slice(0, r).forEach((d, i) => q.splice(i === 0 && Math.random() < .6 ? q.length : 1 + (Math.random() * q.length | 0), 0, d)); q.push('top');   // a decoy often comes right before the real bun
      return { q, gaps: q.map((kd, i) => .3 + Math.random() * .35 + (Math.random() < .25 || (i === q.length - 1 && Math.random() < .6) ? .55 : 0)) };
    });
    const DUR = 12, over = 3 * (.6 / k + win0 + .42) + 1, G = plan.reduce((a, r) => a + r.gaps.reduce((x, y) => x + y, 0), 0) / k, squeeze = Math.min(1, (DUR - over) / G);
    function newRound() {
      queue = plan[round].q.slice(); gaps = plan[round].gaps.map(x => x * squeeze / k);
      stack = [{ k: 'bottom', sq: 1 }]; fly = []; phase = 'drop'; next = gaps.shift(); wob = 1;
    }
    newRound();
    const throwIt = kind => {
      const side = kind === 'top' || DECOY[kind] ? 2 : Math.random() * 2 | 0;   // buns and look-alikes always drop from above
      const sx = side === 0 ? -OX - 90 : side === 1 ? W + OX + 90 : CX + (Math.random() - .5) * 300;
      fly.push({ k: kind, sx, sy: side === 2 ? -60 : 300 + Math.random() * 60, u: 0, T: (.42 + Math.random() * .12) / k, spin: (Math.random() - .5) * 6, arc: side === 2 ? 0 : 110 + Math.random() * 50 });
      sfx.whoosh(side !== 2);
    };
    const landSfx = kind => {
      if (kind === 'duck') snd(900, .12, 'sine', .08, 0, 1400); else if (kind === 'bug') sfx.splat(); else if (kind === 'keyboard') noise(.08, .06, 3000, 5000, 'highpass');
      else if (kind === 'patty') noise(.3, .05, 2500, 4000, 'highpass'); else if (kind === 'top') { sfx.thud(); snd(1320, .18, 'triangle', .06, .02); } else sfx.thud();
    };
    function grab() {
      if (g.result || phase === 'served' || clock < .2) return;
      const topFly = fly.find(f => f.k === 'top');
      if (phase === 'ready' || (topFly && (1 - topFly.u) * topFly.T < .09)) {   // a hair early on the bun still counts
        if (topFly) { for (const f of fly) if (f !== topFly) stack.push({ k: f.k, sq: 1 }); stack.push({ k: 'top', sq: 1 }); fly = []; }
        reacts.push(+(win0 - win).toFixed(3)); served++; sfx.coin(); sfx.pop(); burst(CX, TOPY(), '#FFE14D', 16); ring(CX, (BASE + TOPY()) / 2, '#fff', 150, .4); shake(4, .15);
        if (served >= NEED) { g.result = 'win'; how = 'bite'; resT = 0; sfx.sparkle(); tpop = 1; return; }
        floatText('NICE!', CX, TOPY() - 40, '#5CFF7A', 40); phase = 'served'; sv = { t: 0, items: stack, x: CX, y: BASE };
        return;
      }
      const top = stack[stack.length - 1].k;   // too early: the whole thing topples
      g.result = 'lose'; how = 'early'; resT = 0; sfx.buzz(); sfx.thud(); shake(10, .3);
      if (DECOY[top]) floatText(DECOY[top], CX, 480, '#FFE14D', 44);
      let y = BASE; debris = stack.map(p => { y -= SIZE[p.k] * SC; return { k: p.k, x: CX, y: y + SIZE[p.k] * SC, vx: (Math.random() - .5) * 700, vy: -300 - Math.random() * 400, r: 0, vr: (Math.random() - .5) * 12 }; });
      for (const f of fly) debris.push({ k: f.k, x: f.x, y: f.y, vx: (Math.random() - .5) * 500, vy: -200, r: f.r || 0, vr: 6 });
      stack = []; fly = [];
    }
    const g = {
      cmd: 'BOSS!', hint: 'GRAB WHEN TOP BUN LANDS!', thint: 'TAP WHEN TOP BUN LANDS!', dur: DUR, boss: true, wide: true,
      key(e) { if (e.code === 'Space' || e.code === 'Enter') grab(); },
      down() { grab(); },
      update(dt) {
        clock += dt; if (!g.result && phase !== 'served') SC += (Math.min(1.3, 270 / H_()) - SC) * Math.min(1, dt * 5); wob = Math.max(.25, wob - dt * 1.6); cl.hop = Math.max(0, cl.hop - dt * 3);
        for (const p of stack) { p.sq = Math.max(0, (p.sq || 0) - dt * 5); p.age = (p.age || 0) + dt; }
        tpop = Math.max(0, tpop - dt * 3); if (cl.hopIn > 0 && (cl.hopIn -= dt) <= 0) { cl.hop = .6; snd(520, .1, 'square', .05, 0, 880); }
        if (g.result) {
          resT += dt;
          if (how === 'early') for (const d of debris) { d.vy += 1500 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.r += d.vr * dt; }
          if (how === 'late' && gl) { gl.t += dt; const u = Math.min(1, gl.t / .3); gl.x = -OX - 80 + (CX - 20 + OX + 80) * u; gl.y = 160 + (TOPY() - 30 - 160) * u; if (gl.t > .3) { gl.x += (gl.t - .3) * 900; gl.y -= (gl.t - .3) * 140; } }
          if (how === 'bite') { cl.x += (CX + 78 * SC + 30 - cl.x) * Math.min(1, dt * 10); const b = Math.min(3, Math.floor((resT - .15) / .2) + 1); if (resT > .15 && b > bites) { bites = b; sfx.splat(); snd(300, .08, 'square', .06, 0, 120); burst(CX + 70 * SC, BASE - H_() * SC * (bites * .2 + .1), '#E8A54B', 10); shake(6, .12); cl.hop = 1; if (bites === 1) floatText('CHOMP!', CX + 120, 170, '#FFE14D', 60); } }
          return;
        }
        if (phase === 'served') {   // the finished burger zooms up into the order tracker, a new bun lands
          sv.t += dt * 2.4; if (sv.t >= 1) { round++; newRound(); sfx.boing(); tpop = 1; }
          return;
        }
        if (phase === 'ready') { win -= dt; if (win <= 0) { g.result = 'lose'; how = 'late'; resT = 0; gl = { t: 0, x: -OX - 80, y: 160 }; snd(700, .14, 'sawtooth', .07, 0, 500); snd(760, .16, 'sawtooth', .07, .16, 480); } return; }
        next -= dt;
        if (next <= 0 && queue.length) { const kind = queue.shift(); throwIt(kind); next = gaps.shift() || 0; }
        for (let i = fly.length - 1; i >= 0; i--) {
          const f = fly[i]; f.u += dt / f.T; const ty = TOPY(), u = Math.min(1, f.u);
          f.x = f.sx + (CX - f.sx) * u; f.y = f.sy + (ty - f.sy) * u * u - f.arc * 4 * u * (1 - u); f.r = f.spin * (1 - u);
          if (f.u >= 1) {
            fly.splice(i, 1); stack.push({ k: f.k, sq: 1 }); wob = Math.min(2.4, wob + .5 + stack.length * .08); landSfx(f.k); burst(CX, ty, '#fff', 5, 160);
            if (f.k === 'top') { phase = 'ready'; win = win0; ring(CX, ty - 30, '#FFE14D', 120, .3); }
            else if (DECOY[f.k]) cl.hopIn = .3;   // Claude notices a beat later
          }
        }
      },
      draw(t) {
        X = ctx;
        if (!BG || BGW !== VW || BGO !== OX) {   // bake the static beach once (per screen width)
          const mk = f => { const c = document.createElement('canvas'); c.width = VW; c.height = H; X = c.getContext('2d'); X.translate(OX, 0); f(); X = ctx; return c; };
          BG = mk(paintBack); FG = mk(paintFront); BGW = VW; BGO = OX;
        }
        ctx.drawImage(BG, -OX, 0);
        // live sky + sea: sun rays, drifting clouds, waves, a sailboat
        ctx.save(); ctx.translate(560, 128); ctx.strokeStyle = 'rgba(255,240,150,.6)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; for (let i = 0; i < 12; i++) { const a = now * .25 + i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 40, Math.sin(a) * 40); ctx.lineTo(Math.cos(a) * 54, Math.sin(a) * 54); ctx.stroke(); } ctx.restore();
        for (const [sp_, off, y, s] of [[6, 100, 190, 1], [9, 600, 250, .8], [4, 900, 150, .7]]) cloud(((now * sp_ + off) % (VW + 300)) - 150 - OX, y, s);
        ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        for (let i = 0; i < 12; i++) { const x = ((now * (10 + i % 3 * 4) + i * 97) % (VW + 60)) - OX - 30, y = 342 + (i * 17 % 46); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 22, y); ctx.stroke(); }
        { const bx = ((now * 9) % (VW + 260)) - OX - 130, by = 352 + Math.sin(now * 1.6) * 2.5; X.save(); X.translate(bx, by); X.rotate(Math.sin(now * 1.6) * .05); X.scale(.8, .8);
          line([[0, -4], [0, -64]], '#8a5a34', 4); inkP(polyP('s1', () => [[4, -62], [4, -12], [38, -12]]), '#fff', 3); inkP(polyP('s2', () => [[-4, -56], [-4, -12], [-26, -12]]), '#FFD84A', 3);
          celP(polyP('hull', () => [[-36, -6], [40, -6], [28, 12], [-26, 12]]), '#e8433a', '#b02a2a', 3.5, -2, -3); X.restore(); }
        ctx.drawImage(FG, -OX, 0);
        // the seagull watching from the menu board (it is the thief if you are too slow)
        if (!gl) { const m = g.result ? (how === 'bite' ? 'cry' : 'laugh') : stack.length > 1 && (phase === 'ready' || fly.length) ? 'hungry' : 'calm';
          gull(690, 188 + Math.sin(now * 3) * 1.2, 0, -1, m, 1.1, true, now); }
        // order tickets on a string
        const lit = served - (phase === 'served' && !g.result ? 1 : 0);
        if (g.result !== 'lose') {
          J(); ctx.strokeStyle = '#e6c58c'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(CX - 118, 62); ctx.quadraticCurveTo(CX, 86, CX + 118, 62); ctx.stroke();
          for (let i = 0; i < NEED; i++) { const x = CX + (i - 1) * 58, done = i < lit, pul = (i === lit && !g.result ? 1 + Math.sin(now * 8) * .04 : 1) + (i === lit - 1 ? tpop * .35 : 0);
            X.save(); X.translate(x, 74); X.rotate(Math.sin(now * 1.3 + i) * .04); X.scale(pul, pul);
            celP(rrP(-25, 0, 50, 64, 6), done ? '#fff4dc' : '#f7d297', done ? '#d9d2bc' : '#c9a066', 3.5, -3, -3);
            celP(rrP(-5, -7, 10, 16, 3), '#d9944f', '#a5622c', 2.5, -1, 0);
            X.globalAlpha = done ? 1 : .5; miniBurger(0, 54, 1); X.globalAlpha = 1;
            if (done) { dot(14, 16, 9, '#5CFF7A', 3); line([[9, 16], [13, 20], [19, 12]], '#fff', 3.5, false); }
            X.restore(); }
        }
        const drawStack = (items, bx, by, sc = SC, bite = 0) => {
          X.save(); X.translate(bx, by); X.scale(sc, sc);
          if (bite) { X.beginPath(); X.rect(-200, -400, 400, 420); for (let i = 0; i < bite; i++) X.arc(92, -H_() * (i + 1) * .13 - 8, 44, 0, 7); X.clip('evenodd'); }
          let y = 0;
          items.forEach((p, i) => { const hh = -y / 100, off = Math.sin(now * 7 + .3) * wob * hh * hh * 9; piece(p.k, off, y, off * .004, p.sq || 0, 1, p.age || 0); y -= SIZE[p.k]; });
          X.restore();
          if (phase === 'ready' && items === stack && !g.result) {   // steam + shrinking ring: the bun is hot, grab it!
            const ty = by + y * sc, cy = ty + 30, u = win / win0;
            X.lineCap = 'round'; for (let j = -1; j <= 1; j++) { X.strokeStyle = 'rgba(255,255,255,.8)'; X.lineWidth = 6; X.beginPath(); for (let q = 0; q < 6; q++) X.lineTo(bx + j * 34 + Math.sin(now * 12 + q + j) * 6, ty - 22 - q * 9 - (1 - u) * 16); X.stroke(); }
            X.lineWidth = 12; X.strokeStyle = INK; X.beginPath(); X.ellipse(bx, cy, 112 + 70 * u, 48 + 34 * u, 0, 0, 7); X.stroke(); X.lineWidth = 6; X.strokeStyle = u < .35 ? '#ff6b6b' : '#FFE14D'; X.stroke();
          }
        };
        if (how === 'early') { const k_ = Math.min(1, resT * 6); if (k_ > 0) splat(CX, 500, 46 * (1 - Math.pow(1 - k_, 3)) + 10); }   // the ketchup that outlives the burger
        if (phase === 'served' && sv) { const u = Math.min(1, sv.t), e = u * u; drawStack(sv.items, CX + (served - 2) * 58 * e, BASE + (118 - BASE) * e, SC - (SC - .17) * e); }
        else if (how === 'late' && gl && gl.t > .3) { drawStack(stack, gl.x + 20, gl.y + 30 + H_() * SC); }
        else drawStack(stack, CX, BASE, SC, how === 'bite' ? bites : 0);
        for (const f of fly) piece(f.k, f.x, f.y, f.r, 0, SC);
        for (const d of debris) piece(d.k, d.x, d.y, d.r, 0, SC);
        if (gl) { gull(gl.x, gl.y, now * 22, 1, 'thief', 1.5, false, now);
          if (gl.t > .3) for (let i = 0; i < 6; i++) { const ag = gl.t - .3, fx = CX + (hs(i) - .5) * 240 + Math.sin(ag * 5 + i) * 16, fy = Math.min(520, 330 + ag * (70 + hs(i + 5) * 60) + hs(i + 9) * 60); X.save(); X.translate(fx, fy); X.rotate(Math.sin(ag * 4 + i) * .8); celP(elP(0, 0, 14, 5), '#fff', '#d3d9ea', 2.5, -1, -1); X.restore(); } }
        // Claude at the counter: watches nervously, hops on decoys, chomps at the end
        const nerv = phase === 'ready' && !g.result ? Math.sin(now * 40) * 2 : 0, u = 6.5, cx = cl.x + nerv, cy = 512 - Math.sin(cl.hop * Math.PI) * 34;
        const mood = g.result === 'lose' ? 'sad' : g.result === 'win' || phase === 'served' ? 'happy' : null;
        shadow(cl.x, 514, 50, 10);
        const rz = g.result === 'win' ? 1 : g.result === 'lose' ? .05 : phase === 'ready' ? .72 : phase === 'served' ? .9 : .18 + Math.sin(now * 1.6) * .03;
        arms(cx, cy, u, rz);
        claude(cx, cy, u, { mood });
        chefHat(cx, cy - 9 * u + Math.sin(now * 3.1) * .8, g.result === 'win' ? Math.sin(now * 9) * .12 : 0);
        if ((phase === 'ready' || how === 'late' || how === 'early') && Math.floor(now * 3) >= 0) { const sw = (now * .9 + (how ? .3 : 0)) % 1; X.fillStyle = '#9fe3ff'; X.globalAlpha = 1 - sw * .8; X.beginPath(); X.ellipse(cx + 40, cy - 54 + sw * 26, 4, 6, 0, 0, 7); X.fill(); X.strokeStyle = INK; X.lineWidth = 2; X.stroke(); X.globalAlpha = 1; }
        if (how === 'bite') for (let i = 0; i < 6; i++) { const ag = resT - i * .09 - .1; if (ag > 0 && ag < 1.2) { X.globalAlpha = Math.min(1, (1.1 - ag) * 3); heart(cl.x + (hs(i) - .5) * 70, 430 - ag * 110, 9 + hs(i + 3) * 5); X.globalAlpha = 1; } }
        if (how === 'early' || how === 'late') txt(how === 'early' ? 'NOT YET!' : 'TOO SLOW!', W / 2, 150 + Math.sin(now * 20) * 3, 58, '#FF4D4D');   // above the FAIL stamp
        vignette(.2);
      },
      probe: () => ({ phase, round, served, need: NEED, top: stack.length ? stack[stack.length - 1].k : null, decoyOnTop: !!(stack.length && DECOY[stack[stack.length - 1].k]),
        flying: fly.map(f => f.k), topIn: (f => f ? +((1 - f.u) * f.T).toFixed(3) : null)(fly.find(f => f.k === 'top')), queue: queue.length, grabNow: phase === 'ready' && !g.result, windowLeft: +win.toFixed(3), window: +win0.toFixed(3), result: g.result || null, how, reacts })
    };
    return g;
  };
})();
