'use strict';
/* Shared crew drawing kit, following docs/ART-STYLE.md. Seven places, one per game; every seat has its own station in the same scene
   (yours is bigger and has the YOU tag) and its own slot meter built into the set. Decorative variation is deterministic; nothing here
   consumes the room RNG or changes a game verdict. Static scenery is baked once per kind. */
const CrewArt = (() => {
  const TAU = Math.PI * 2, backgrounds = new Map(), DEF = ['#4DB8FF', '#FF4D9E', '#FFE14D', '#5CFF7A'];
  let X = ctx, S = null;
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v, lerp = (a, b, k) => a + (b - a) * k;
  const hash = (a, b) => { const q = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return q - Math.floor(q); };
  function rr(x, y, w, h, r = 12) { r = Math.min(r, w / 2, h / 2); X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
  function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, TAU); }
  function ink(fill, o = 4, col = INK) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = col; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
  function panel(x, y, w, h, col, shade, light, r = 12, o = 4) {
    rr(x, y, w, h, r); ink(shade, o); X.save(); X.clip(); X.translate(-4, -5); rr(x, y, w, h, r); X.fillStyle = col; X.fill(); X.restore();
    if (light) { X.save(); rr(x, y, w, h, r); X.clip(); X.fillStyle = light; rr(x + 7, y + 5, Math.max(4, w - 19), 7, 3); X.fill(); X.restore(); }
  }
  function celOval(x, y, rx, ry, col, shade, light, o = 4, rot = 0) {
    el(x, y, rx, ry, rot); ink(shade, o); X.save(); X.clip(); el(x - 5, y - 5, rx, ry, rot); X.fillStyle = col; X.fill();
    if (light) { el(x - rx * .3, y - ry * .45, rx * .34, ry * .18, -.4); X.fillStyle = light; X.fill(); } X.restore();
  }
  function tube(points, col, w = 5) { X.beginPath(); points.forEach(([x, y], i) => i ? X.lineTo(x, y) : X.moveTo(x, y)); X.lineWidth = w + 7; X.lineJoin = X.lineCap = 'round'; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = col; X.stroke(); }
  function line(points, col, w) { X.beginPath(); points.forEach(([x, y], i) => i ? X.lineTo(x, y) : X.moveTo(x, y)); X.lineWidth = w; X.lineJoin = X.lineCap = 'round'; X.strokeStyle = col; X.stroke(); }
  function poly(points, fill, o = 3) { X.beginPath(); points.forEach(([x, y], i) => i ? X.lineTo(x, y) : X.moveTo(x, y)); X.closePath(); ink(fill, o); }
  function gradient(y0, y1, stops) { const g = X.createLinearGradient(0, y0, 0, y1); stops.forEach(([at, col]) => g.addColorStop(at, col)); return g; }
  function sparkle(x, y, r, col = '#fff') { X.fillStyle = col; X.beginPath(); X.moveTo(x, y - r); X.quadraticCurveTo(x, y, x + r, y); X.quadraticCurveTo(x, y, x, y + r); X.quadraticCurveTo(x, y, x - r, y); X.quadraticCurveTo(x, y, x, y - r); X.fill(); }
  function eyes(x, y, r, look, mood, T) {
    for (const s of [-1, 1]) {
      const ex = x + s * r * 1.3;
      if (mood === 'happy' || mood === 'bonk' || mood === 'sad' || Math.sin(T * 1.9 + s * .2) > .985) { X.beginPath(); if (mood === 'bonk' || mood === 'sad') { X.moveTo(ex - r * .6, y - r * .5); X.lineTo(ex + r * .5, y); X.lineTo(ex - r * .6, y + r * .5); } else X.arc(ex, y + r * .3, r * .7, Math.PI * 1.1, Math.PI * 1.9); X.strokeStyle = INK; X.lineWidth = Math.max(2.5, r * .35); X.lineCap = 'round'; X.stroke(); continue; }
      el(ex, y, r, mood === 'panic' ? r * 1.3 : r * 1.08); ink('#fff', Math.max(1.5, r * .22));
      const px = ex + look * r * .35; el(px, y + r * .1, r * .5, r * .58); X.fillStyle = INK; X.fill(); el(px - r * .15, y - r * .15, r * .18, r * .18); X.fillStyle = '#fff'; X.fill();
    }
  }
  function mouth(x, y, mood, width = 18) {
    if (mood === 'eat' || mood === 'panic') { el(x, y, width, width * .68); ink('#6e1838', 3); el(x, y + width * .35, width * .6, width * .2); X.fillStyle = '#ff92ad'; X.fill(); }
    else { X.beginPath(); X.moveTo(x - width, y); X.quadraticCurveTo(x, y + (mood === 'sad' || mood === 'bonk' ? -8 : 10), x + width, y); X.strokeStyle = INK; X.lineWidth = Math.max(2.5, width * .22); X.lineCap = 'round'; X.stroke(); }
  }
  const seatCol = r => (S.seats[r] && S.seats[r].color) || DEF[r], seatName = r => (S.seats[r] && S.seats[r].name) || 'P' + (r + 1);
  function tag(x, y, label, col, small, raw) {
    const s = raw ? label : t(label), w = clamp(String(s).length * (small ? 7.4 : 9) + 18, small ? 40 : 54, small ? 84 : 110), h = small ? 18 : 23, fs = small ? 12 : 15;
    X.beginPath(); X.moveTo(x - 6, y + h / 2); X.lineTo(x, y + h / 2 + 8); X.lineTo(x + 6, y + h / 2); X.closePath(); ink(col, 2.5);
    panel(x - w / 2, y - h / 2, w, h, col, '#8f88a6', 'rgba(255,255,255,.4)', h / 2, 2.5);
    if (raw) { X.font = `700 ${fs}px Fredoka, "Helvetica Neue", Arial, sans-serif`; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillStyle = INK; X.fillText(s, x, y + 1, w - 10); }
    else txt(label, x, y + 1, fs, INK, 'center', w - 10);
  }
  function tick(x, y, r = 11) { celOval(x, y, r, r, '#5CFF7A', '#24803a', '#b2f27f', 3); line([[x - r * .5, y], [x - r * .1, y + r * .45], [x + r * .55, y - r * .4]], '#fff', r * .32); }
  function sweat(x, y, s) { X.save(); X.translate(x, y + (S.T * 18 % 14)); X.globalAlpha = 1 - (S.T * 18 % 14) / 16; X.beginPath(); X.moveTo(0, -s * 1.5); X.quadraticCurveTo(s, s * .2, 0, s); X.quadraticCurveTo(-s, s * .2, 0, -s * 1.5); ink('#a9e4ff', 1.5); X.restore(); }
  /* Claude with arms: o.hand = [dx,dy] (px, from the character's feet) is where the right arm reaches; pose 'cheer' = both up, 'balance' = out wide. */
  function actor(x, y, u, col, mood, T, o = {}) {
    shadow(x, y + 7, 6 * u, u, .2); X.save(); X.translate(x, y + Math.sin(T * 2.3 + (o.ph || 0)) * 2 * (u > 4 ? 1 : .6));
    const cheer = mood === 'happy' || o.pose === 'cheer';
    if (cheer) X.translate(0, -Math.abs(Math.sin(T * 9 + (o.ph || 0))) * u * 1.3);
    if (o.pose === 'balance') { tube([[-6 * u, -6 * u], [-13 * u, -8 * u + Math.sin(T * 7) * u]], col, u); tube([[6 * u, -6 * u], [13 * u, -8 * u - Math.sin(T * 7) * u]], col, u); }
    else {
      tube([[-6 * u, -5 * u], [-9 * u, cheer ? -9 * u : -8 * u], [-9 * u, cheer ? -13 * u : -10 * u]], col, u);
      if (o.hand) tube([[6 * u, -5 * u], [o.hand[0] * .5 + 4 * u, (o.hand[1] - 5 * u) * .5 - 5 * u], o.hand], col, u);
      else tube([[6 * u, -5 * u], [9 * u, cheer ? -9 * u : -7 * u], [9 * u, cheer ? -13 * u : -6 * u]], col, u);
    }
    claude(0, 0, u, { col, mood: mood === 'bonk' || mood === 'sad' ? 'sad' : mood });
    rr(-5 * u, -8.1 * u, 10 * u, 4.5 * u, 3); X.fillStyle = col; X.fill(); eyes(0, -6.1 * u, u * 1.2, o.look || 0, mood, T);
    X.fillStyle = 'rgba(255,255,255,.24)'; rr(-5.3 * u, -8.8 * u, 3 * u, u, 3); X.fill();
    for (const s of [-1, 1]) { el(s * 4.3 * u, -4.3 * u, u * .8, u * .4); X.fillStyle = 'rgba(255,110,165,.5)'; X.fill(); }
    if (o.sweat) sweat(7.5 * u, -9.5 * u, Math.max(2, u * .8));
    X.restore();
  }
  /* seat r drawn at (x,y): you = big + YOU tag + halo; the others get a small name tag, a done tick and sweat while they are still working */
  function crew(x, y, u, r, o = {}) {
    const you = r === S.role, col = seatCol(r), m = o.mood || S.mood(r), working = !S.result && !S.done(r);
    if (you && !S.demo) { X.save(); X.globalAlpha = .35 + .15 * Math.sin(S.T * 4); el(x, y + 8, 7.5 * u, 1.5 * u); X.fillStyle = '#fff6a8'; X.fill(); X.restore(); }
    actor(x, y, u, col, m, S.T, { hand: o.hand, pose: o.pose, look: o.look, ph: r * 1.3, sweat: working && !you && S.c > 7 && S.progress[r] < .7 });
    if (o.noTag) return;
    const ty = o.tagY != null ? o.tagY : y - 12.5 * u - (you ? 8 : 3), label = you ? t('YOU') : seatName(r);
    tag(x, ty, label, col, !you, !you);
    if (S.done(r)) tick(x + (you ? 66 : 52), ty, you ? 12 : 9);
  }
  /* slot meter: a themed pill whose fill is the seat's colour; icon = tiny prop of the scene at its left end */
  function icon(kind, x, y, r) {
    if (kind === 'drop') celOval(x, y, r * .75, r, '#9fe3ff', '#4aa8d8', '#fff', 2);
    else if (kind === 'cog') { for (let i = 0; i < 6; i++) { const a = i * TAU / 6; el(x + Math.cos(a) * r * .8, y + Math.sin(a) * r * .8, r * .32, r * .32); ink('#cfd8e6', 1.5); } celOval(x, y, r * .72, r * .72, '#cfd8e6', '#8f9cb3', '#fff', 2); }
    else if (kind === 'ball') celOval(x, y, r, r, '#ff5c8a', '#b8283a', '#ffb3c9', 2);
    else if (kind === 'fly') { celOval(x - r * .6, y - r * .5, r * .7, r * .35, '#e4f5ff', '#9fc6df', '#fff', 1.5, -.4); celOval(x, y, r * .7, r * .55, '#5a5274', '#3b3550', '#c9c3d6', 2); }
    else if (kind === 'flag') { poly([[x - r * .8, y - r], [x + r * .9, y], [x - r * .8, y + r]], '#ffd23f', 2); }
    else if (kind === 'plank') panel(x - r, y - r * .6, r * 2, r * 1.2, '#e3a868', '#a5622c', null, 3, 2);
    else celOval(x, y, r * .7, r * .9, '#fffbea', '#d9d3ea', '#fff', 2);
  }
  function meter(x, y, w, r, ic, big) {
    const p = clamp(S.progress[r]), h = big ? 20 : 13, col = seatCol(r), done = p >= 1;
    rr(x, y, w, h, h / 2); ink('#4a4262', 3);
    if (p > .005) { X.save(); rr(x, y, w, h, h / 2); X.clip(); X.fillStyle = done ? '#5CFF7A' : col; X.fillRect(x, y, Math.max(h, w * p), h); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(x, y + 2, Math.max(h, w * p), h * .22); X.restore(); }
    if (r === S.role && big) for (let i = 1; i < 4; i++) { X.fillStyle = 'rgba(20,16,28,.25)'; X.fillRect(x + w * i / 4 - 1, y + 2, 2, h - 4); }
    icon(ic, x - 4, y + h / 2, h * .85); if (done) tick(x + w + 2, y + h / 2, h * .62);
  }
  function badge(s, x, y, size, bgc, fg, sc, rot) {
    if (sc <= .01) return; X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const tw = Math.min(250, X.measureText(t(s)).width), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
    X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc); X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
    rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4); X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill(); txt(s, 0, 2, size, fg || '#fff', 'center', 250); X.restore();
  }
  const pop = (s, x, y, size, bg, fg, rot, k = S.gag) => badge(s, x, y, size, bg, fg, k < .25 ? k * 4 * 1.15 : 1 + Math.max(0, .35 - k) * .5, rot);
  function cloud(x, y, s) { X.save(); X.translate(x, y); X.scale(s, s); for (const [a, b, r] of [[0, 0, 22], [24, -12, 26], [50, 0, 20], [24, 7, 22]]) { el(a, b, r, r); ink('#e4f5ff', 3); } for (const [a, b, r] of [[0, 0, 22], [24, -12, 26], [50, 0, 20]]) { el(a - 3, b - 5, r * .8, r * .8); X.fillStyle = '#fff'; X.fill(); } X.restore(); }
  function tree(x, y, s) { X.save(); X.translate(x, y); X.scale(s, s); panel(-9, -28, 18, 58, '#8a5a34', '#5b3d24', '#ba8c56', 4, 3); for (const [a, b, r] of [[-25, -52, 30], [20, -60, 35], [0, -85, 32]]) celOval(a, b, r, r, '#3fb260', '#2f7a49', '#5bcf72', 3); X.restore(); }
  function duck(x, y, s, dir, T, hat) {
    X.save(); X.translate(x, y); X.scale(s * dir, s); celOval(0, 0, 18, 10, '#fffbea', '#d9d3ea', '#fff', 2); celOval(13, -10, 9, 10, '#fffbea', '#d9d3ea', '#fff', 2);
    tube([[20, -9], [28, -8]], '#ffd23f', 3); el(15, -13, 2, 2); X.fillStyle = INK; X.fill(); if (hat) { poly([[8, -19], [14, -34], [20, -19]], hat, 2); } X.restore();
  }
  /* ───── supporting cast: each has its own personality and reacts to the verdict ───── */
  function sloth(x, y, s, T) {                                              // car-wash attendant: asleep on a stool until the bus honks
    X.save(); X.translate(x, y); X.scale(s, s); const awake = S.won || S.lost;
    panel(-30, 6, 60, 12, '#d9944f', '#a5622c', '#f2b878', 4, 3); tube([[-22, 18], [-26, 50]], '#a5622c', 6); tube([[22, 18], [26, 50]], '#a5622c', 6);
    X.save(); if (S.lost) X.rotate(clamp(S.gag * 1.2) * .9), X.translate(S.gag * 18, S.gag * 8);
    celOval(0, -20, 26, 30, '#9b7a5a', '#6b4f39', '#c4a07e', 4); tube([[-22, -22], [-30, awake && S.won ? -50 - Math.sin(T * 12) * 5 : -4]], '#9b7a5a', 7); tube([[22, -22], [30, awake && S.won ? -50 + Math.sin(T * 12) * 5 : -4]], '#9b7a5a', 7);
    celOval(0, -50, 22, 19, '#9b7a5a', '#6b4f39', '#c4a07e', 4); celOval(0, -48, 15, 12, '#e9d3b4', '#b99c77', null, 2);
    if (awake) { el(-7, -50, 4, 5); ink('#fff', 1.5); el(7, -50, 4, 5); ink('#fff', 1.5); el(-7, -49, 1.8, 2.4); X.fillStyle = INK; X.fill(); el(7, -49, 1.8, 2.4); X.fill(); } else { line([[-11, -50], [-4, -48]], INK, 2.5); line([[11, -50], [4, -48]], INK, 2.5); }
    celOval(0, -44, 3.5, 2.5, INK, INK, null, 0); X.restore();
    if (!awake) { for (let i = 0; i < 2; i++) { const k = (T * .5 + i * .5) % 1; X.save(); X.globalAlpha = 1 - k; txt('Z', 24 + k * 14, -66 - k * 24, 14 + i * 4, '#fff'); X.restore(); } }
    X.restore();
  }
  function catC(x, y, s, T, mood) {                                          // party-hat cat: hates balloons
    X.save(); X.translate(x, y); X.scale(s, s); const scared = mood === 'pop';
    celOval(0, -18, 22, 26, '#f0a24a', '#b86a1f', '#ffd08a', 4); tube([[24, -8], [46, -12 + Math.sin(T * 3) * 6], [50, -30]], '#f0a24a', 6);
    X.save(); X.translate(0, scared ? -10 - Math.abs(Math.sin(T * 14)) * 8 : 0);
    poly([[-18, -52], [-14, -74], [-4, -56]], '#f0a24a', 3); poly([[18, -52], [14, -74], [4, -56]], '#f0a24a', 3); celOval(0, -46, 22, 18, '#f0a24a', '#b86a1f', '#ffd08a', 4);
    el(-8, -48, 5, scared ? 7 : 5); ink('#fff', 1.5); el(8, -48, 5, scared ? 7 : 5); ink('#fff', 1.5); el(-8 + (scared ? 0 : 1.5), -48, 2, scared ? 4 : 3); X.fillStyle = INK; X.fill(); el(8 + (scared ? 0 : 1.5), -48, 2, scared ? 4 : 3); X.fill();
    poly([[-3, -42], [3, -42], [0, -38]], '#ff92ad', 1.5); for (const sd of [-1, 1]) { line([[sd * 5, -40], [sd * 20, -42]], INK, 1.5); line([[sd * 5, -38], [sd * 19, -35]], INK, 1.5); }
    poly([[-9, -62], [0, -92], [9, -62]], mood === 'win' ? '#5CFF7A' : '#ff5c8a', 2.5); celOval(0, -93, 4, 4, '#ffd23f', '#c99512', null, 2);
    X.restore(); X.restore();
  }
  function elephant(x, y, s, T) {                                            // circus elephant peeking in from the right: trunk trumpets on a win, ears over its eyes on a loss
    X.save(); X.translate(x, y); X.scale(s, s); const win = S.won, lose = S.lost, sw = Math.sin(T * 2) * 8;
    celOval(0, 0, 66, 60, '#a9b2c9', '#7a85a4', '#d3d9e8', 5);
    tube([[-46, 14], [-70, 38 + sw * .3], [-76, 76], [win ? -60 : -78, win ? 40 - Math.abs(Math.sin(T * 9)) * 18 : 98 + sw * .5]], '#a9b2c9', 20);
    celOval(-24, -46, 12, 8, '#a9b2c9', '#7a85a4', null, 0);
    celOval(40, -10, 34, 46 - (lose ? 0 : 0), '#c3cadc', '#8d97b3', '#e6ebf6', 4);
    if (lose) celOval(-22, -4, 30, 42, '#c3cadc', '#8d97b3', '#e6ebf6', 4);
    else { el(-24, -14, 8, win ? 2 : 9); ink('#fff', 2); el(-24, -12, 3.5, win ? 1 : 5); X.fillStyle = INK; X.fill(); }
    poly([[-26, -50], [-14, -76], [-2, -50]], win ? '#5CFF7A' : '#ff5c8a', 3);
    X.restore();
  }
  function beaver(x, y, s, T) {                                              // bridge foreman: hard hat, clipboard, taps his foot; thumbs up / facepalm
    X.save(); X.translate(x, y); X.scale(s, s); const win = S.won, lose = S.lost, tap = Math.sin(T * 8) > .3 && !win && !lose;
    tube([[22, 20], [60, 24 + Math.sin(T * 3) * 4]], '#6b4326', 14);
    celOval(0, -10, 28, 34, '#a8693a', '#6b4326', '#d09560', 4); celOval(0, 0, 18, 24, '#f0d7a8', '#b99c77', null, 2);
    tube([[-26, 14], [-36 + (tap ? 4 : 0), 30]], '#a8693a', 8); tube([[26, 14], [36, 30]], '#a8693a', 8);
    X.save(); X.translate(0, lose ? 3 : 0); celOval(0, -46, 24, 21, '#a8693a', '#6b4326', '#d09560', 4);
    el(-7, -48, 5, 5.5); ink('#fff', 1.5); el(7, -48, 5, 5.5); ink('#fff', 1.5); X.fillStyle = INK; el(-6, -47, 2.2, 3); X.fill(); el(8, -47, 2.2, 3); X.fill();
    celOval(0, -39, 6, 4, '#4a2e1a', '#2b1a0e', null, 1.5); panel(-5, -37, 4, 8, '#fff', '#c9ced6', null, 1, 1.5); panel(1, -37, 4, 8, '#fff', '#c9ced6', null, 1, 1.5);
    X.beginPath(); X.arc(0, -56, 24, Math.PI, 0); X.closePath(); ink('#ffd23f', 3); rr(-26, -57, 52, 6, 3); ink('#c99512', 2); X.restore();
    if (win) { tube([[24, -2], [38, -28], [36, -52 - Math.sin(T * 12) * 3]], '#a8693a', 8); celOval(36, -58, 6, 6, '#a8693a', '#6b4326', null, 2); }
    else if (lose) tube([[24, -2], [14, -26], [6, -42]], '#a8693a', 8);
    else { panel(18, -8, 26, 32, '#fffbea', '#c9c3d6', null, 3, 2.5); for (let i = 0; i < 3; i++) line([[22, 0 + i * 8], [38, 0 + i * 8]], '#8f88a6', 2); tube([[22, 4], [22, 10]], '#a8693a', 7); }
    X.restore();
  }
  function cow(x, y, s, T) {                                                 // barn cow over the half door: chews, goes MOO on a win/lose
    X.save(); X.translate(x, y); X.scale(s, s); const chew = Math.sin(T * 6) * 2, big = S.won || S.lost;
    celOval(-30, -40, 14, 9, '#fffbea', '#d9d3ea', null, 3, -.5); celOval(30, -40, 14, 9, '#fffbea', '#d9d3ea', null, 3, .5);
    celOval(0, -12, 34, 38, '#fffbea', '#d9d3ea', '#fff', 4); el(-14, -30, 12, 9); X.fillStyle = '#4a4262'; X.fill(); celOval(0, 6, 22, 16 + (big ? 4 : chew * .5), '#ff92ad', '#d85c85', '#ffc3d3', 3);
    el(-9, 6, 2.5, 3.5); X.fillStyle = INK; X.fill(); el(9, 6, 2.5, 3.5); X.fill();
    for (const sd of [-1, 1]) { el(sd * 14, -18, 7, big ? 9 : 7); ink('#fff', 2); el(sd * 14 + sd, -17, 3, big ? 5 : 3.5); X.fillStyle = INK; X.fill(); }
    poly([[-22, -46], [-26, -64], [-14, -52]], '#fff3a0', 2.5); poly([[22, -46], [26, -64], [14, -52]], '#fff3a0', 2.5);
    X.restore();
  }
  function frogC(x, y, s, col, mood, T, look = 0, tie) {
    const shade = '#2f7a49', light = '#b2f27f';
    X.save(); X.translate(x, y); X.scale(s * (1 + Math.sin(T * 3) * .02), s * (1 - Math.sin(T * 3) * .02));
    for (const side of [-1, 1]) { celOval(side * 68, 30, 35, 23, col, shade, light, 4); celOval(side * 33, -40, 24, 29, col, shade, light, 4); }
    celOval(0, 0, 77, 55, col, shade, light, 5); celOval(0, 18, 56, 28, '#d8f0b0', '#9ec97b', '#e6f7c8', 3);
    eyes(0, -34, 20, look, mood, T); mouth(0, 21, mood, 25);
    for (const side of [-1, 1]) { el(side * 54, 6, 12, 6); X.fillStyle = 'rgba(255,110,165,.55)'; X.fill(); }
    if (tie) { poly([[0, 42], [-26, 30], [-26, 56]], tie, 3); poly([[0, 42], [26, 30], [26, 56]], tie, 3); celOval(0, 43, 7, 7, tie, '#8f88a6', null, 2.5); }
    X.restore();
  }
  function flyC(x, y, T, hit) {
    celOval(x, y, 13, 10, '#5a5274', '#3b3550', '#c9c3d6', 3); for (const s of [-1, 1]) celOval(x + s * 10, y - 10 + Math.sin(T * 40 + s) * 2, 14, 7, '#e4f5ff', '#9fc6df', '#fff', 2, s * .5); eyes(x, y - 1, 3, 0, hit ? 'happy' : 'idle', T);
  }
  function hen(x, y, T, mood, s = 1) {
    X.save(); X.translate(x, y); X.scale(s, s); X.rotate(Math.sin(T * 4) * .04); celOval(0, 0, 40, 28, '#fffbea', '#d9d3ea', '#fff', 4); celOval(1, 5, 23, 15, '#e3ac66', '#b98042', '#f7d297', 2);
    for (let i = 0; i < 3; i++) celOval(24 + i * 7, -37, 7, 10, '#ff4d5e', '#b8283a', '#ff9d9d', 2);
    celOval(27, -21, 22, 25, '#fffbea', '#d9d3ea', '#fff', 3); eyes(31, -26, 5, 1, mood, T); tube([[45, -17], [60, -14]], '#ffd23f', 5); tube([[-12, 23], [-17, 34]], '#d9944f', 3); tube([[12, 23], [18, 34]], '#d9944f', 3); X.restore();
  }
  function chick(x, y, s, T, ph) {
    X.save(); X.translate(x, y - Math.abs(Math.sin(T * 9 + ph)) * 6 * s); X.scale(s, s); celOval(0, 0, 12, 11, '#ffe14d', '#e0a800', '#fff3a0', 2.5); poly([[8, -1], [16, 1], [8, 3]], '#ff9a4d', 1.5); el(4, -4, 2, 2.4); X.fillStyle = INK; X.fill(); X.restore();
  }
  function egg(x, y, s, rot = 0, col = '#fffbea') { celOval(x, y, 13 * s, 17 * s, col, col === '#fffbea' ? '#d9d3ea' : '#c99512', '#fff', 3, rot); }
  /* ───── baked backgrounds ───── */
  function wallFloor(wall0, wall1, floor0, floor1, floorY) {
    X.fillStyle = gradient(0, floorY, [[0, wall0], [1, wall1]]); X.fillRect(0, 0, 800, 600);
    X.fillStyle = gradient(floorY, 600, [[0, floor0], [1, floor1]]); X.fillRect(0, floorY, 800, 600 - floorY); tube([[0, floorY], [800, floorY]], '#e3a868', 4);
  }
  function background(kind) {
    if (backgrounds.has(kind)) return backgrounds.get(kind);
    const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 600; const old = X; X = canvas.getContext('2d');
    try {
      if (kind === 0) {                       // car wash bay: blue tiles, wet concrete, big brush rollers
        wallFloor('#8fc7de', '#d9f1f7', '#8c93a8', '#5f667c', 445);
        X.strokeStyle = 'rgba(255,255,255,.4)'; X.lineWidth = 2; for (let x = 0; x <= 800; x += 66) { X.beginPath(); X.moveTo(x, 0); X.lineTo(x, 445); X.stroke(); } for (let y = 0; y <= 445; y += 66) { X.beginPath(); X.moveTo(0, y); X.lineTo(800, y); X.stroke(); }
        for (let y = 470; y < 600; y += 30) tube([[0, y], [800, y]], '#7b8298', 1);
        for (const [px, py, pw] of [[90, 530, 90], [610, 505, 110], [330, 562, 60]]) { el(px, py, pw, 11); X.fillStyle = 'rgba(160,215,245,.55)'; X.fill(); }
        for (const x of [14, 744]) { panel(x, 96, 42, 306, '#3fb2e8', '#1f77ad', '#9be0ff', 14, 4); for (let i = 0; i < 9; i++) tube([[x + 6, 112 + i * 33], [x + 36, 112 + i * 33]], '#ff5c8a', 5); tube([[x + 21, 60], [x + 21, 96]], '#7b8298', 8); }
          } else if (kind === 1) {                // workshop: warm planks, pegboard, a window and a girder for the hoist
        wallFloor('#e6b878', '#ffe0a8', '#b97a46', '#8a5530', 445);
        for (let i = 0; i < 12; i++) { X.fillStyle = 'rgba(200,120,70,.12)'; X.fillRect(i * 70, 0, 22, 445); }
        for (let y = 464; y < 600; y += 29) tube([[0, y], [800, y]], '#a16a40', 1);
        panel(668, 118, 112, 172, '#d9944f', '#a5622c', '#f2b878', 12, 4); panel(678, 128, 92, 142, '#86d8fb', '#3c6fb4', '#d6f7ff', 8, 3); tube([[724, 128], [724, 270]], '#d9944f', 5);
        panel(40, 88, 612, 24, '#8d9bbd', '#5f6c8c', '#c7d0e8', 8, 4); for (let i = 0; i < 16; i++) { el(56 + i * 38, 100, 3, 3); X.fillStyle = '#5f6c8c'; X.fill(); }
      } else if (kind === 2) {                // circus big top
        X.fillStyle = '#ffe9c6'; X.fillRect(0, 0, 800, 600);
        for (let i = -8; i < 9; i++) { X.beginPath(); X.moveTo(400, -60); X.lineTo(400 + i * 120 - 60, 460); X.lineTo(400 + i * 120 + 60, 460); X.closePath(); X.fillStyle = i % 2 ? '#d9344a' : '#fff1d6'; X.fill(); }
        X.fillStyle = 'rgba(40,20,60,.18)'; X.fillRect(0, 0, 800, 600); X.fillStyle = gradient(0, 120, [[0, 'rgba(20,10,40,.55)'], [1, 'rgba(20,10,40,0)']]); X.fillRect(0, 0, 800, 120);
        X.fillStyle = gradient(430, 600, [[0, '#e0b070'], [1, '#b98042']]); X.fillRect(0, 430, 800, 170); el(400, 470, 440, 54); ink('#d9a86a', 5); X.save(); el(400, 470, 440, 54); X.clip(); for (let i = 0; i < 40; i++) { el(hash(i, 1) * 800, 440 + hash(i, 2) * 80, 2, 1); X.fillStyle = 'rgba(120,70,30,.3)'; X.fill(); } X.restore();
        for (let i = 0; i < 12; i++) { const x = 40 + i * 66; X.beginPath(); X.moveTo(x - 14, 62); X.lineTo(x + 14, 62); X.lineTo(x, 92); X.closePath(); ink(['#ff5c8a', '#FFE14D', '#6EA8FE'][i % 3], 2); } tube([[0, 62], [800, 62]], '#fff1d6', 3);
      } else if (kind === 3 || kind === 5) {  // pond / river meadow
        X.fillStyle = gradient(0, 390, [[0, '#36b0ea'], [.55, '#86d8fb'], [1, '#d6f7ff']]); X.fillRect(0, 0, 800, 600);
        if (kind === 5) { for (const [mx, mw, mh, c1] of [[110, 300, 190, '#9cc5e8'], [470, 360, 150, '#b4d3ef'], [740, 280, 210, '#9cc5e8']]) { X.beginPath(); X.moveTo(mx - mw / 2, 330); X.lineTo(mx, 330 - mh); X.lineTo(mx + mw / 2, 330); X.closePath(); X.fillStyle = c1; X.fill(); } }
        else for (let i = 0; i < 3; i++) { el(140 + i * 320, 372, 300, 130); X.fillStyle = i % 2 ? '#87d19b' : '#a9dfc6'; X.fill(); }
        X.fillStyle = gradient(kind === 5 ? 300 : 374, 600, [[0, '#8fdc5c'], [1, '#5fb944']]); X.fillRect(0, kind === 5 ? 300 : 374, 800, 300); tube([[0, kind === 5 ? 300 : 374], [800, kind === 5 ? 300 : 374]], '#4f9a6a', 3);
        if (kind === 3) {
          tree(40, 386, .9); tree(760, 389, 1);
          for (let x = 25; x < 800; x += 95) panel(x, 340, 17, 66, '#e3a868', '#c4874e', '#f2c184', 4, 3); for (const yy in [0, 1]) panel(0, 358 + yy * 24, 800, 12, '#e3a868', '#c4874e', '#f2c184', 4, 3);
          el(400, 430, 395, 108); ink('#f4d998', 4); el(400, 434, 380, 98); X.fillStyle = gradient(330, 535, [[0, '#62d3f0'], [1, '#2a8fcb']]); X.fill();
        } else {
          X.fillStyle = gradient(300, 470, [[0, '#4cc0ea'], [1, '#2788c4']]); X.fillRect(0, 300, 800, 170); for (let i = 0; i < 16; i++) { const x = hash(i, 3) * 800, y = 330 + hash(i, 4) * 120; tube([[x, y], [x + 26, y]], 'rgba(255,255,255,.5)', 2); }
          X.fillStyle = gradient(470, 600, [[0, '#8fdc5c'], [1, '#5fb944']]); X.fillRect(0, 470, 800, 130); tube([[0, 470], [800, 470]], '#4f9a6a', 3);
          X.fillStyle = '#8fdc5c'; X.beginPath(); X.moveTo(0, 290); X.lineTo(96, 290); X.lineTo(104, 470); X.lineTo(0, 470); X.fill(); X.beginPath(); X.moveTo(800, 290); X.lineTo(704, 290); X.lineTo(696, 470); X.lineTo(800, 470); X.fill();
          tube([[96, 292], [106, 470]], '#4f9a6a', 3); tube([[704, 292], [694, 470]], '#4f9a6a', 3); tree(36, 300, .8);
        }
        for (let i = 0; i < 18; i++) { const x = (i * 137) % 800, y = 485 + i * 37 % 60; tube([[x - 6, y], [x - 10, y - 7]], '#3f8f35', 1); tube([[x, y], [x + 2, y - 10]], '#3f8f35', 1); }
      } else if (kind === 4) {                // party hall
        X.fillStyle = '#8fe0c9'; X.fillRect(0, 0, 800, 600); for (let i = 0; i < 12; i++) { X.fillStyle = 'rgba(255,255,255,.28)'; X.fillRect(i * 70, 0, 34, 445); }
        wallFloor('rgba(0,0,0,0)', 'rgba(0,0,0,0)', '#c98a52', '#8a5530', 445); for (let y = 464; y < 600; y += 29) tube([[0, y], [800, y]], '#a16a40', 1); for (let i = 0; i < 8; i++) tube([[i * 112 + (i % 2 ? 50 : 0), 445], [i * 112 + (i % 2 ? 50 : 0), 600]], '#8a5530', 1);
        panel(0, 400, 800, 45, '#ffd7a8', '#d9a86a', '#fff', 0, 3); panel(14, 282, 130, 12, '#d9944f', '#a5622c', '#f2b878', 4, 3); tube([[30, 294], [30, 306]], '#a5622c', 5); tube([[128, 294], [128, 306]], '#a5622c', 5);
        for (const [bx, by, bc] of [[748, 150, '#ff5c8a'], [772, 190, '#6EA8FE'], [726, 196, '#FFE14D'], [752, 236, '#5CFF7A']]) { tube([[bx, by + 18], [760, 330]], '#8f88a6', 1.5); celOval(bx, by, 20, 24, bc, '#8f88a6', '#fff', 3); }
      } else {                                // barn
        wallFloor('#b3473b', '#e08a6a', '#e3b86a', '#b98042', 445);
        for (let i = 0; i < 14; i++) tube([[i * 60, 0], [i * 60, 445]], '#8f2f2f', 2); for (const x of [40, 760]) panel(x - 24, 60, 48, 380, '#f6efe0', '#c9bda4', '#fff', 6, 3);
        panel(88, 245, 624, 24, '#d9944f', '#a5622c', '#f2b878', 8, 4); panel(116, 264, 18, 180, '#d9944f', '#a5622c', '#f2b878', 5, 3); panel(666, 264, 18, 180, '#d9944f', '#a5622c', '#f2b878', 5, 3);
        for (let i = 0; i < 70; i++) { const x = hash(i, 5) * 800, y = 450 + hash(i, 6) * 130; tube([[x, y], [x + 16, y - 6 + hash(i, 7) * 8]], '#d9a04a', 1.5); }
        panel(700, 380, 90, 70, '#d9944f', '#a5622c', '#f2b878', 6, 4); X.fillStyle = '#2b1a2e'; X.fillRect(708, 388, 74, 10);
      }
    } finally { X = old; }
    backgrounds.set(kind, canvas); return canvas;
  }
  function control(label, lit, pressed, key) {
    if (S.demo) return;
    const res = S.result, kind = S.kind;
    if (res) label = (res === 'win' ? ['ALL CLEAN!', 'RESCUED!', 'BALANCED!', 'FULL TUMMY!', 'READY TO FLY!', 'BRIDGE READY!', 'EGGS SAVED!'] : ['MUD AGAIN!', 'OOPS!', 'DROPPED IT!', 'MISSED!', 'POP!', 'SPLASH!', 'CRACK!'])[kind];
    const y = pressed ? 464 : 458, col = res ? '#d3cfe0' : lit ? '#4fd06a' : '#ffd23f', dk = res ? '#8f88a6' : lit ? '#24803a' : '#c99512';
    shadow(405, 539, 200, 9, .25); panel(200, 466, 400, 68, dk, dk, null, 20, 4); panel(200, y, 400, 68, col, dk, 'rgba(255,255,255,.4)', 20, 4);
    if (TOUCH) label = label.replace(' / HOLD SPACE', '');
    txt(label, 400, y + 23, 25, res ? '#f6f4fb' : INK, 'center', 370);
    if (!TOUCH && !res) { panel(334, y + 40, 132, 20, '#fff', '#c9ced6', null, 6, 2); txt(key, 400, y + 50, 13, INK, 'center', 118); }
  }
  /* ───── the seven scenes ───── */
  const others = () => S.mates;
  function mateSlots(m, cx, gap) { return Array.from({ length: m }, (_, i) => cx + (i - (m - 1) / 2) * gap); }

  function sceneWipers() {
    const { T, c, n, role, progress: P, value, xs, act, won, lost, gag } = S, col = seatCol(role), mates = others(), m = mates.length;
    // idle gag: rollers spin their bristles, bubbles rise, the attendant naps
    for (const x of [14, 744]) { X.save(); rr(x, 96, 42, 306, 14); X.clip(); for (let i = 0; i < 12; i++) { const yy = 96 + ((i * 33 + T * 40 * (x < 100 ? 1 : -1)) % 330); X.fillStyle = 'rgba(255,255,255,.4)'; X.fillRect(x, yy, 42, 5); } X.restore(); }
    for (let i = 0; i < 10; i++) { const k = (T * .22 + i * .1) % 1, bx = (i % 2 ? 40 : 770) + Math.sin(T + i) * 10, by = 440 - k * 340; el(bx, by, 4 + i % 3 * 2, 4 + i % 3 * 2); ink('rgba(255,255,255,.55)', 1.2, 'rgba(255,255,255,.9)'); }
    sloth(750, 452, .85, T);
    // the bus: wheels, upper deck for the crew, lower deck for you
    X.save(); if (won) X.translate(0, -Math.abs(Math.sin(S.end * 12)) * 9 * (1 - clamp(S.end / 1.1)));
    for (const x of [210, 600]) { celOval(x, 440, 38, 38, '#3b3550', '#211d32', '#5a5274', 5); celOval(x, 440, 19, 19, '#cfd8e6', '#8f9cb3', '#fff', 3); }
    panel(150, 60, 500, 154, '#ffd23f', '#c99512', '#fff3a0', 30, 5);
    for (let i = 0; i < m; i++) {
      const r = mates[i], gw = Math.min(172, 480 / m - 20), cx = 400 + (i - (m - 1) / 2) * (480 / Math.max(m, 1)) * (m > 1 ? 1 : 0), gx = cx - gw / 2;
      panel(gx - 6, 84, gw + 12, 70, '#e3a868', '#a5622c', null, 14, 3); panel(gx, 90, gw, 58, '#86d8fb', '#3c6fb4', '#d6f7ff', 10, 3);
      X.save(); rr(gx + 2, 92, gw - 4, 54, 8); X.clip(); for (let k = 0; k < 9; k++) { el(gx + 8 + hash(r, k) * (gw - 16), 98 + hash(k, r) * 42, 8 + hash(r + 1, k) * 8, 6); X.fillStyle = `rgba(122,82,55,${.9 * (1 - clamp(P[r]))})`; X.fill(); } X.restore();
      const sx = gx + 14 + xs[r] * (gw - 28), hx = cx + (xs[r] - .5) * 30;
      panel(sx - 14, 94, 28, 44, '#ffd23f', '#c99512', '#fff3a0', 8, 2.5); tube([[sx, 138], [hx, 188]], '#cfd8e6', 4);
      meter(gx + 14, 158, gw - 28, r, 'drop', false);
    }
    panel(99, 201, 606, 232, '#ffd23f', '#c99512', '#fff3a0', 34, 5);
    for (let i = 0; i < m; i++) {
      const r = mates[i], gw = Math.min(172, 480 / m - 20), cx = 400 + (i - (m - 1) / 2) * (480 / Math.max(m, 1)) * (m > 1 ? 1 : 0), sx = cx - gw / 2 + 14 + xs[r] * (gw - 28);
      crew(cx, 203, 2.9, r, { hand: [(sx - cx) * .4 + 14, -44], tagY: 72, pose: S.done(r) ? 'cheer' : '' });
    } panel(116, 220, 572, 175, '#86d8fb', '#3c6fb4', '#d6f7ff', 20, 4);
    actor(530, 385, 6.2, '#D97757', lost ? 'sad' : won ? 'happy' : 'idle', T, { look: -1 }); tube([[610, 266], [610, 384]], '#d9944f', 5);
    X.save(); rr(122, 226, 560, 163, 16); X.clip(); for (let i = 0; i < 25; i++) { el(142 + i * 97 % 520, 245 + i * 53 % 122, 17 + i % 4 * 4, 12); X.fillStyle = `rgba(122,82,55,${.9 * (1 - clamp(P[role]))})`; X.fill(); } X.restore();
    const x = 110 + value * 580; panel(x - 21, 242, 43, 127, '#ffd23f', '#c99512', '#fff3a0', 12, 3); tube([[x, 369], [x, 384]], '#cfd8e6', 7); celOval(x, 391, 15, 15, col, '#8f88a6', '#fff', 3);
    meter(262, 408, 276, role, 'drop', true);
    if (won) { for (let i = 0; i < 9; i++) { const k = (S.end * 2.2 + i * .13) % 1; sparkle(130 + hash(i, 1) * 560, 80 + hash(i, 2) * 320, 8 + k * 10, i % 2 ? '#fff' : '#fff3a0'); } X.fillStyle = '#5a5274'; }
    if (lost) {                                                         // the mud truck's tyre sprays the whole bus
      X.save(); X.beginPath(); X.rect(0, 40, 800, 410); X.clip();
      for (let i = 0; i < 22; i++) { const k = clamp(gag * 1.5 - hash(i, 9) * .5), bx = 790 - k * (140 + hash(i, 3) * 640), by = 110 + hash(i, 4) * 300, r = (14 + hash(i, 5) * 24) * k; if (k > 0) { el(bx, by, r, r * .8); X.fillStyle = '#7a5237'; X.fill(); el(bx - r * .3, by - r * .3, r * .4, r * .3); X.fillStyle = '#a07a58'; X.fill(); if (r > 20) tube([[bx, by], [bx, by + r * 2.2 * gag]], '#7a5237', 6); } }
      X.restore(); celOval(836 - gag * 100, 470, 64, 64, '#3b3550', '#211d32', '#5a5274', 6);
    }
    X.restore();
    if (won) { pop('HONK!', 96, 150, 26, '#ffd23f', INK, -.2); }
    if (lost) pop('SPLAT!', 96, 150, 26, '#7a5237', '#fff', .15);
    crew(64, 454, 5.6, role, { look: 1, pose: won ? 'cheer' : '' });
    control('SWEEP LEFT / RIGHT', P[role] >= 1, false, '← → / A D');
  }

  function sceneSpin() {
    const { T, c, n, role, progress: P, won, lost, gag, end, act } = S, col = seatCol(role), mates = others(), m = mates.length, mean = P.reduce((a, b) => a + b, 0) / n;
    const lift = mean * 150, plat = 392 - lift + (lost ? gag * 70 : 0), wake = won ? clamp(end / .8) : 0;
    // girder, shelf and bench
    panel(40, 236, 440, 16, '#d9944f', '#a5622c', '#f2b878', 6, 4); panel(205, 252, 210, 190, '#c98a52', '#8f5b2d', '#e3a868', 14, 4);
    // cat on the girder follows the frog with its eyes
    X.save(); X.translate(626, 90); X.scale(.62, .62); X.save(); X.translate(0, 10); X.restore(); catC(0, 10, 1, T, won ? 'win' : ''); X.restore();
    // ropes: one per seat, in the seat's colour, from its wheel up to the girder and down to the hoist
    const seatsAll = Array.from({ length: n }, (_, r) => r), px = 545 + 0;
    seatsAll.forEach((r, k) => {
      const you = r === role, mi = mates.indexOf(r), wx = you ? 382 : mateSlots(m, 165, 95)[mi], wy = you ? 262 : 145, rope = 100 + k * 5, dx = px + (k + .5) * 90 / n, slack = lost ? gag * 14 : 0;
      tube([[wx, wy], [wx, rope], [dx, rope], [dx, plat - 10 - slack]], seatCol(r), 3);
    });
    // hoist platform and the sleepy frog
    const fy = plat - 44, fm = won ? (wake > .25 ? 'happy' : 'idle') : lost ? 'bonk' : mean > .5 ? 'panic' : 'idle';
    panel(536, plat - 8, 110, 16, '#cfd8e6', '#8f9cb3', '#fff', 6, 3);
    let jump = 0; if (won && wake > .3) jump = Math.sin(clamp((wake - .3) / .7) * Math.PI) * 60;
    frogC(590, fy - jump, .8, '#b49cf0', fm, T); X.save(); X.globalCompositeOperation = 'source-over';
    if (!won && !lost) { for (let i = 0; i < 3; i++) { const k = (T * .5 + i * .33) % 1; X.save(); X.globalAlpha = 1 - k; txt('Z', 640 + k * 24, fy - 50 - k * 36, 14 + i * 4, '#fff'); X.restore(); } if (mean < .85) { celOval(618, fy - 8 + 0, 4 + Math.abs(Math.sin(T * 1.6)) * 7, 4 + Math.abs(Math.sin(T * 1.6)) * 7, 'rgba(160,220,255,.8)', '#4aa8d8', null, 1.5); } }
    X.restore();
    if (won && wake > .2) { for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + T; star(590 + Math.cos(a) * 74, fy - jump - 10 + Math.sin(a) * 48, 7, 3, 5, a, '#FFE14D', 2); } pop('TA-DA!', 590, fy - jump - 90, 22, '#ff5c8a', '#fff', -.1, clamp(wake)); }
    if (lost) { pop('ZZZ...', 590, fy - 80, 20, '#6b5fa8', '#fff', .08); }
    // mates: crank wheel on the shelf with a gauge ring, small Claude behind it
    const sl = mateSlots(m, 165, 95);
    mates.forEach((r, i) => {
      const x = sl[i], a = P[r] * TAU * 3, kx = x + Math.cos(a) * 24, ky = 175 + Math.sin(a) * 24;
      tube([[x, 175], [x, 236]], '#a5622c', 6); ring(x, 175, 40, r, 5); celOval(x, 175, 31, 31, '#cfd8e6', '#8f9cb3', '#fff', 4);
      for (let k = 0; k < 4; k++) line([[x, 175], [x + Math.cos(a + k * TAU / 4) * 26, 175 + Math.sin(a + k * TAU / 4) * 26]], '#d9944f', 5);
      celOval(x, 175, 7, 7, '#cfd8e6', '#8f88a6', '#fff', 2); celOval(kx, ky, 8, 8, seatCol(r), '#8f88a6', '#fff', 2.5);
      crew(x + 4, 236, 2.8, r, { hand: [kx - x, ky - 236 + 4], tagY: 124 });
    });
    // your wheel
    ring(310, 334, 102, role, 9);
    celOval(310, 334, 90, 90, '#cfd8e6', '#8f9cb3', '#fff', 5); celOval(310, 334, 68, 68, '#ffd23f', '#c99512', '#fff3a0', 4);
    const a = P[role] * TAU * 3; for (let i = 0; i < 5; i++) line([[310, 334], [310 + Math.cos(a + i * TAU / 5) * 60, 334 + Math.sin(a + i * TAU / 5) * 60]], '#d9944f', 7);
    celOval(310, 334, 16, 16, '#cfd8e6', '#8f9cb3', '#fff', 3); const kx = 310 + Math.cos(a) * 78, ky = 334 + Math.sin(a) * 78; celOval(kx, ky, 21, 21, col, '#8f88a6', '#fff', 4);
    crew(120, 448, 5.6, role, { look: 1, hand: [kx - 120, ky - 448] });
    control('DRAG IN CIRCLES / HOLD SPACE', P[role] >= 1, false, 'SPACE');
  }
  function ring(x, y, r, seat, w) {                                      // gauge ring around a wheel: the seat's slot filling
    const p = clamp(S.progress[seat]), done = p >= 1;
    X.beginPath(); X.arc(x, y, r, 0, TAU); X.lineWidth = w + 6; X.strokeStyle = INK; X.stroke(); X.lineWidth = w; X.strokeStyle = '#4a4262'; X.stroke();
    if (p > .005) { X.beginPath(); X.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + p * TAU); X.lineWidth = w; X.strokeStyle = done ? '#5CFF7A' : seatCol(seat); X.lineCap = 'round'; X.stroke(); }
    if (done) tick(x + r * .72, y - r * .72, w + 3);
  }

  function sceneBalance() {
    const { T, c, n, role, progress: P, value, target, xs, act, won, lost, gag, end } = S, col = seatCol(role), mates = others(), m = mates.length;
    // spotlights sweep over the ring
    X.save(); for (const [sx, ph] of [[170, 0], [630, 2]]) { const tx = 400 + Math.sin(T * .8 + ph) * 250; X.beginPath(); X.moveTo(sx - 14, 0); X.lineTo(sx + 14, 0); X.lineTo(tx + 90, 440); X.lineTo(tx - 90, 440); X.closePath(); X.fillStyle = 'rgba(255,248,200,.13)'; X.fill(); } X.restore();
    elephant(742, 424, .85, T);
    // other seats: mini beams high up the tent
    const sl = mateSlots(m, 400, m > 2 ? 235 : 300);
    mates.forEach((r, i) => {
      const cx = sl[i], w = 184, x = cx - w / 2 + 14 + xs[r] * (w - 28), by = 182, ready = S.done(r);
      tube([[cx - w / 2, by], [cx + w / 2, by]], '#d9944f', 8); tube([[cx - w / 2 + 10, by], [cx - w / 2 + 4, by + 40]], '#a5622c', 5); tube([[cx + w / 2 - 10, by], [cx + w / 2 - 4, by + 40]], '#a5622c', 5);
      seal(x, by - 6, .5, 0, S.mood(r) === 'happy' ? 'happy' : 'idle'); const tilt = (xs[r] - .5) * .3 + Math.sin(T * 4 + r) * .1 * (1 - P[r]);
      X.save(); X.translate(x, by - 27); X.rotate(won || ready ? 0 : tilt); crew(0, 0, 2.2, r, { pose: ready || won ? 'cheer' : 'balance', noTag: true }); X.restore();
      tag(cx, by - 70, seatName(r), seatCol(r), true, true); if (ready) tick(cx + 54, by - 70, 9); meter(cx - 60, by + 26, 120, r, 'ball', false);
    });
    // your beam
    const bx = 110 + value * 580, by = 370, off = Math.abs(value - target), zone = off < .08;
    tube([[110, by], [690, by]], '#d9944f', 14); tube([[130, by], [120, by + 62]], '#a5622c', 8); tube([[670, by], [680, by + 62]], '#a5622c', 8);
    panel(110 + (target - .08) * 580, by - 14, .16 * 580, 29, '#5CFF7A', '#24803a', '#b2f27f', 8, 3);
    const lx = bx + (lost ? gag * 110 : 0), fall = lost ? gag * gag * 24 : 0;
    seal(lx, by - 6, 1, fall, S.mood(role), (target - value) * 3);
    X.save(); X.translate(lx, by - 42 + (lost ? Math.sin(clamp(gag * 1.3) * Math.PI) * -34 + gag * 56 : 0)); X.rotate(lost ? gag * 1.6 : clamp((value - target) * 1.2, -.5, .5) + Math.sin(T * 6) * .04); crew(0, 0, 4, role, { pose: won ? 'cheer' : 'balance', tagY: -58 - 4, look: 0 }); X.restore();
    meter(205, 404, 390, role, 'ball', true);
    if (won) for (let i = 0; i < 8; i++) { const k = (end * 1.4 + i * .12) % 1; star(100 + hash(i, 1) * 600, 90 + k * 120, 6 + i % 3 * 2, 3, 5, i + end * 5, ['#FFE14D', '#ff5c8a', '#6EA8FE'][i % 3], 2); }
    if (lost) pop('SPLAT!', 580, 170, 24, '#6b5fa8', '#fff', .1);
    control('KEEP THE BALL IN GREEN', zone, false, '← → / A D');
  }
  function seal(x, by, s, fall, mood, look = 0) {
    X.save(); X.translate(x, by + fall); X.scale(s, s); shadow(0, 34, 48, 9, .2);
    celOval(0, -2, 43, 35, '#a4b1f2', '#8492e2', '#c9d0fb', 5); celOval(-3, -11, 34, 27, '#c9d0fb', '#a4b1f2', '#f6f8ff', 3);
    eyes(0, -26, 8, look, mood === 'happy' ? 'happy' : mood === 'bonk' || mood === 'sad' ? 'bonk' : 'idle', S.T); mouth(0, 4, mood, 12); for (const sd of [-1, 1]) { line([[sd * 8, -12], [sd * 26, -12 + sd * 2]], '#fff', 2); line([[sd * 8, -9], [sd * 24, -4]], '#fff', 2); }
    for (const sd of [-1, 1]) tube([[sd * 24, 14], [sd * 50, 26 + (S.won ? Math.sin(S.T * 14) * 6 : 0)]], '#a4b1f2', 10); X.restore();
  }

  function sceneFrog() {
    const { T, c, n, role, progress: P, flash, act, xs, won, lost, gag, end } = S, col = seatCol(role), mates = others(), m = mates.length, ph = Math.sin(c * 3);
    const near = Math.abs(ph) < .38;
    // duck judge floating on the pond
    duck(640 + Math.sin(T * .6) * 20, 505, 1, 1, T, '#ff5c8a');
    const sl = m === 1 ? [650] : m === 2 ? [200, 650] : [200, 585, 712];
    mates.forEach((r, i) => {
      const cx = sl[i], pad = 378, shoot = act[r] > .45, fx = cx + Math.sin(c * 3) * 66, fyy = 228 + (i % 2) * 14;
      celOval(cx, pad, 56, 14, '#78cc72', '#3fa64a', '#b2f27f', 3);
      if (!lost) flyC(fx, fyy, T, shoot);
      if (shoot && !lost) tube([[cx - 18, pad - 40], [fx, fyy + 6]], '#ff92ad', 6);
      frogC(cx - 20, pad - 28, .36, '#6fd660', won ? 'happy' : lost ? 'bonk' : shoot ? 'eat' : 'idle', T + i, Math.sin(c * 3), seatCol(r));
      if (lost) flyC(cx - 20, pad - 44 + Math.sin(T * 9) * 2, T, true);
      if (won) for (let k = 0; k < 3; k++) { const q = (end * 1.3 + k * .33 + i * .11) % 1; el(cx - 8 + k * 6, pad - 44 - q * 70, 4, 4); ink('rgba(255,255,255,.6)', 1.2, '#fff'); }
      crew(cx + 40, pad + 6, 2.2, r, { tagY: pad - 52 - 12 + 0, pose: won || S.done(r) ? 'cheer' : '' }); meter(cx - 44, pad + 30, 88, r, 'fly', false);
    });
    // your frog, big, on its pad
    celOval(400, 417, 143, 25, '#78cc72', '#3fa64a', '#b2f27f', 4);
    const x = 400 + ph * 220, y = 225;
    if (!lost) flyC(x, y, T, flash > 0);
    const mood = flash > 0 ? 'eat' : won ? 'happy' : lost ? 'bonk' : S.mood(role);
    frogC(400, 350, 1.15, '#6fd660', mood, T, ph, col);
    if (flash > 0) tube([[400, 373], [x, 225]], '#ff92ad', 12);
    if (lost) {                                                         // the tongue ties itself in a knot while the fly sits on the nose
      const k = gag; tube([[400, 373], [400 + 40 * k, 395], [360, 380 - 20 * k], [420, 372 + 6 * k], [388, 362]], '#ff92ad', 12); flyC(402, 322 + Math.sin(T * 9) * 2, T, true); pop('RIBBIT!', 560, 180, 22, '#6b5fa8', '#fff', .1);
    }
    if (won) { for (let i = 0; i < 5; i++) { const q = (end * 1.2 + i * .2) % 1; el(400 + (i - 2) * 22, 340 - q * 120, 6, 6); ink('rgba(255,255,255,.6)', 1.5, '#fff'); } pop('RIBBIT!', 560, 180, 22, '#ff5c8a', '#fff', -.1); }
    crew(125, 446, 5.4, role, { look: 1, pose: won ? 'cheer' : '' });
    meter(285, 435, 230, role, 'fly', true);
    control(near ? 'FEED NOW!' : 'WAIT FOR THE FLY', near, flash > 0, 'SPACE');
  }

  function sceneDragon() {
    const { T, c, n, role, progress: P, charge, act, won, lost, gag, end } = S, col = seatCol(role), mates = others(), m = mates.length, mean = P.reduce((a, b) => a + b, 0) / n;
    catC(78, 282, .95, T, lost ? 'pop' : won ? 'win' : '');
    // bunting: one pennant per seat that fills up
    X.beginPath(); X.moveTo(-6, 62); X.quadraticCurveTo(320, 128, 640, 62); X.lineWidth = 5; X.strokeStyle = INK; X.stroke(); X.lineWidth = 2.5; X.strokeStyle = '#fffbea'; X.stroke();
    for (let r = 0; r < n; r++) {
      const fx = 120 + (r + .5) * 480 / n, q = (fx + 6) / 646, fy = (1 - q) * 62 * 1 + q * 62 + 4 * 0 + Math.sin(q * Math.PI) * 33 * 1.05 + 1, sc = r === role ? 1.3 : 1, p = clamp(P[r]);
      X.save(); X.translate(fx, fy); X.scale(sc, sc); X.rotate(Math.sin(T * 3 + r) * .05); const flagPoly = [[-22, 0], [22, 0], [0, 54]];
      X.beginPath(); flagPoly.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.closePath(); ink('#fffbea', 3.5); X.save(); X.clip(); X.fillStyle = p >= 1 ? '#5CFF7A' : seatCol(r); X.fillRect(-24, 54 - p * 54, 48, p * 54 + 2); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(-24, 54 - p * 54, 48, 4); X.restore();
      X.beginPath(); flagPoly.forEach(([a, b], i) => i ? X.lineTo(a, b) : X.moveTo(a, b)); X.closePath(); X.lineWidth = 3.5; X.strokeStyle = INK; X.stroke();
      if (p >= 1) star(0, 18, 9, 4, 5, T * 2, '#FFE14D', 2); X.restore();
      if (r === role) { tube([[fx, fy + 74], [fx, fy + 84]], '#fff6a8', 3); poly([[fx - 8, fy + 80], [fx + 8, fy + 80], [fx, fy + 70]], '#fff6a8', 2); }
    }
    // dragon
    const rise = won ? clamp(end / .8) * 60 : 0, dy = 318 + (lost ? gag * 73 : 0) - rise, sc = (.75 + mean * .25 + charge * .08) * (lost ? 1 - gag * .55 : 1);
    if (lost && gag < .4) { for (let i = 0; i < 10; i++) { const a = i * TAU / 10, k = gag / .4; star(537 + Math.cos(a) * (40 + k * 90), 318 + Math.sin(a) * (40 + k * 80), 8, 3.5, 4, a, '#b49cf0', 2); } }
    dragonC(540, dy, sc, '#b49cf0', S.mood(role) === 'happy' || won ? 'happy' : lost ? 'bonk' : charge > .9 ? 'panic' : 'idle', T, won ? clamp(end / .5) : 0);
    // mates' pumps: each with a hose to the dragon's belly and a small Claude on the handle
    const sl = m === 1 ? [690] : m === 2 ? [640, 738] : [330, 640, 738];
    mates.forEach((r, i) => {
      const px = sl[i], pump = Math.sin(T * 13 + r) * 9 * act[r], hx = px - 56;
      X.save(); X.setLineDash([5, 9]); X.lineDashOffset = -T * (20 + act[r] * 60); line([[hx + 22, 438], [530, 400]], seatCol(r), 4 + act[r] * 3); X.restore();
      panel(hx - 22, 426, 44, 24, '#d9944f', '#a5622c', '#f2b878', 6, 3); tube([[hx, 426], [hx, 404 + pump]], '#cfd8e6', 6); panel(hx - 20, 392 + pump, 40, 14, seatCol(r), '#8f88a6', '#fff', 6, 3);
      crew(px + 8, 450, 2.9, r, { hand: [hx - px - 8, 399 + pump - 450], tagY: 404, pose: S.done(r) ? 'cheer' : '' });
    });
    // your pump: unchanged controls, plus the hose in your colour
    tube([[232, 393], [300, 418], [400, 412], [470, 388]], col, 7); panel(153, 356, 89, 62, '#d9944f', '#a5622c', '#f2b878', 15, 4); tube([[197, 355], [197, 301 - charge * 42]], '#cfd8e6', 11); panel(157, 287 - charge * 42, 80, 22, col, '#8f88a6', '#fff', 9, 4);
    panel(303, 189, 230, 25, '#fffbea', '#d9d3ea', '#fff', 9, 3); panel(303 + .55 / 1.05 * 230, 189, .4 / 1.05 * 230, 25, '#5CFF7A', '#24803a', null, 7, 2); tube([[303 + Math.min(1, charge / 1.05) * 230, 182], [303 + Math.min(1, charge / 1.05) * 230, 222]], '#ff4d5e', 3);
    crew(77, 448, 5.4, role, { look: 1, hand: [153 - 77, 300 - charge * 42 - 448], pose: won ? 'cheer' : '' });
    if (lost) pop('POP!', 600, 150, 28, '#ff5c8a', '#fff', .12); if (won) pop('TA-DA!', 600, 150, 24, '#ffd23f', INK, -.1);
    control(charge >= .55 && charge <= .95 ? 'RELEASE NOW!' : 'HOLD TO PUMP', charge >= .55 && charge <= .95, charge > 0, 'SPACE');
  }
  function dragonC(x, y, s, col, mood, T, fire) {
    X.save(); X.translate(x, y); X.scale(s, s); X.rotate(Math.sin(T * 2) * .025);
    for (const side of [-1, 1]) { X.beginPath(); X.moveTo(side * 54, -10); X.quadraticCurveTo(side * 99, -77, side * 125, -42); X.lineTo(side * 114, 18); X.quadraticCurveTo(side * 93, -7, side * 70, 38); X.closePath(); ink('#ffe0a8', 4); tube([[side * 65, 0], [side * 106, -38]], '#d9944f', 3); }
    celOval(0, 18, 77, 89, col, '#7a63b9', 'rgba(255,255,255,.32)', 5); celOval(-9, 48, 40, 52, '#ffe0a8', '#d9a86a', '#fff4d8', 3);
    for (const side of [-1, 1]) { X.beginPath(); X.moveTo(side * 36, -49); X.quadraticCurveTo(side * 67, -100, side * 57, -32); X.closePath(); ink('#fff3b0', 3); }
    celOval(0, -12, 58, 45, col, '#7a63b9', 'rgba(255,255,255,.32)', 4); eyes(0, -20, 16, 0, mood, T); mouth(0, 8, mood, 20);
    if (fire) { for (let i = 0; i < 4; i++) { const k = clamp(fire * 1.4 - i * .12); if (k > 0) { el(30 + k * 90 + i * 20, 8 - k * 58 + i * 5, 14 * k + 3, 9 * k + 2); ink(i % 2 ? '#ffd23f' : '#ff7a3d', 2); } } }
    X.restore();
  }

  function sceneBridge() {
    const { T, c, n, role, progress: P, flash, act, won, lost, gag, end } = S, col = seatCol(role), mates = others(), near = Math.abs(Math.sin(c * 3.5)) < .35, w = 580 / (n * 3);
    // river life: a fish jumps now and then
    const fk = (T * .35) % 1; if (fk < .35) { const q = fk / .35, fx = 220 + Math.floor(T * .35) % 3 * 150 + q * 60; celOval(fx, 470 - Math.sin(q * Math.PI) * 70, 14, 8, '#ff9a4d', '#c4551a', '#ffd0a8', 2, -.6 + q * 1.2); }
    beaver(730, 322, .9, T);
    // bridge: stringers, then planks that fill with each seat's colour; unfinished planks fall on a loss
    tube([[91, 313], [708, 313]], '#e6c58c', 5); tube([[91, 345], [708, 345]], '#a5622c', 8); tube([[91, 402], [708, 402]], '#a5622c', 8);
    for (let i = 0; i <= n * 3; i += 3) tube([[111 + i * w, 313], [111 + i * w, 345]], '#e6c58c', 5);
    for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) {
      const x = 111 + (i * 3 + j) * w, f = clamp(P[i] * 3 - j), drop = lost && P[i] < 1 && f > 0 ? gag * gag * 56 : 0;
      el(x + (w - 6) / 2, 372, (w - 6) / 2, 24); X.fillStyle = 'rgba(30,110,170,.35)'; X.fill();
      if (f > 0) { X.save(); X.translate(x + (w - 6) / 2, 351 + 25 + drop); X.rotate(drop ? gag * (j - 1) * .8 : 0); const hh = 51 * f; panel(-(w - 6) / 2, 25 - hh, w - 6, hh, seatCol(i), '#a5622c', 'rgba(255,255,255,.4)', 6, 3); X.restore(); }
    }
    if (lost) for (let i = 0; i < n; i++) if (P[i] < 1 && P[i] > 0) { const k = clamp((gag - .45) / .55); if (k > 0 && k < 1) { el(111 + (i * 3 + 1.5) * w, 440, 30 * k + 8, 8 * k + 3); X.lineWidth = 3; X.strokeStyle = 'rgba(255,255,255,.8)'; X.stroke(); } }
    mates.forEach(r => {
      const cx = 111 + (r * 3 + 1.5) * w, hit = act[r] > .3, ph = hit ? Math.sin(act[r] * 10) : -.3;
      crew(cx, 345, 2.7, r, { hand: [14 + ph * 6, -44 - (hit ? 10 : 0)], tagY: 300, pose: S.done(r) ? 'cheer' : '' }); if (hit) star(cx + 18, 360, 8, 3, 5, T * 9, '#FFE14D', 2);
    });
    // you stand on the bank with the big hammer rig; your span is marked
    const ox = 111 + (role * 3 + 1.5) * w; poly([[ox - 8, 292], [ox + 8, 292], [ox, 304]], '#fff6a8', 2); if (!S.demo) { }
    crew(60, 345, 5.4, role, { look: 1, pose: won ? 'cheer' : '' });
    const hx = 400 + Math.sin(c * 3.5) * 190; panel(333, 193, 134, 17, '#5CFF7A', '#24803a', '#b2f27f', 7, 3); celOval(hx, 202, 7, 10, '#ff4d5e', '#b8283a', '#ff9d9d', 2);
    X.save(); X.translate(hx, 252); X.rotate(flash > 0 ? .4 : Math.sin(c * 3.5) * .2); tube([[0, 0], [0, 75]], '#d9944f', 12); panel(-40, -23, 80, 40, '#6EA8FE', '#3c6fb4', '#c9d0fb', 14, 4); for (const side of [-1, 1]) panel(side * 37 - 8, -27, 16, 47, '#ffd23f', '#c99512', '#fff3a0', 7, 3); X.restore();
    meter(250, 424, 300, role, 'plank', true);
    if (won) for (let k = 0; k < 3; k++) { const q = clamp(end / .85 - k * .14); if (q > 0 && q < 1) duck(60 + q * 700, 332 - Math.abs(Math.sin(q * 30)) * 6, 1, 1, T, ['#ff5c8a', '#6EA8FE', '#FFE14D'][k]); }
    if (won) pop('QUACK!', 400, 270, 22, '#ffd23f', INK, -.08, clamp(end / .4));
    if (lost) pop('SPLASH!', 560, 262, 24, '#2788c4', '#fff', .1);
    control(near ? 'HAMMER NOW!' : 'WAIT FOR GREEN', near, flash > 0, 'SPACE');
  }

  function sceneEggs() {
    const { T, c, n, role, progress: P, value, target, flash, act, xs, won, lost, gag, end } = S, col = seatCol(role), mates = others(), m = mates.length;
    cow(745, 440, .9, T); panel(700, 420, 90, 40, '#d9944f', '#a5622c', '#f2b878', 6, 4);
    const cycle = Math.floor(c / 1.2), phase = c % 1.2 / 1.2, sl = mateSlots(m, 340, 210);
    // other seats: little stalls up in the loft, a hen on a rail dropping eggs into their basket
    mates.forEach((r, i) => {
      const cx = sl[i], bw = 190, bx = cx - bw / 2 + 30 + xs[r] * (bw - 60), top = 100, catchY = 148, ph = (c + i * .17) % 1.2 / 1.2, caught = act[r] > .25 || ph > .87 && act[r] > .02;
      panel(cx - bw / 2, 58, bw, 118, 'rgba(255,240,214,.18)', 'rgba(60,20,30,.25)', null, 12, 3);
      tube([[cx - bw / 2 + 8, top - 14], [cx + bw / 2 - 8, top - 14]], '#a5622c', 4);
      hen(bx, top, T + i, 'idle', .36);
      if (ph < .87) egg(bx + 14 * .36, top + 8 + ph * 62, .75, .1); else if (ph < .97) { if (!caught) { el(bx + 30, 168, 12, 4); X.fillStyle = '#ffd23f'; X.fill(); } }
      crew(bx, 176, 2.7, r, { noTag: true, pose: S.done(r) || won ? 'cheer' : '' }); panel(bx - 22, 141, 44, 14, '#e3ac66', '#b98042', '#f7d297', 5, 3);
      tag(cx, 72, seatName(r), seatCol(r), true, true); if (S.done(r)) tick(cx + 58, 72, 9);
      // vertical egg gauge
      rr(cx - bw / 2 + 6, 90, 10, 70, 5); ink('#4a4262', 2.5); X.save(); rr(cx - bw / 2 + 6, 90, 10, 70, 5); X.clip(); X.fillStyle = S.done(r) ? '#5CFF7A' : seatCol(r); X.fillRect(cx - bw / 2 + 6, 160 - 70 * clamp(P[r]), 10, 70); X.restore();
    });
    // your lane
    const ex = 110 + 580 * (.18 + ((cycle * .37 + target) % .64)); hen(ex, 218, T, lost ? 'bonk' : 'idle');
    if (phase < .87) egg(ex, 290 + phase * 135, 1, .1);
    const x = 110 + value * 580; crew(x, 423, 6, role, { look: 0, tagY: 423 - 74 - 12 });
    panel(x - 51, 408, 102, 32, '#e3ac66', '#b98042', '#f7d297', 13, 4); for (let i = 0; i < 6; i++) tube([[x - 40 + i * 16, 412], [x - 40 + i * 16, 435]], '#c98443', 2); tube([[x - 45, 424], [x + 44, 424]], '#f7d297', 2);
    if (won) for (let i = 0; i < 5; i++) chick(x - 36 + i * 18, 405, 1.1, T, i * 1.7);
    if (lost) { const k = clamp(gag * 2); const ey = 280 + k * 120; celOval(x, 338 + 4, 30, 14 * k + 2, '#fffbea', '#d9d3ea', '#fff', 3); celOval(x, 338, 12 * k + 2, 10 * k + 2, '#ffd23f', '#c99512', '#fff3a0', 2); tube([[x + 6, 346], [x + 8, 346 + 40 * gag]], '#ffd23f', 6); pop('CRACK!', 560, 190, 24, '#ffb52e', INK, .1); }
    meter(250, 442, 300, role, 'egg', true);
    if (won) pop('TA-DA!', 560, 190, 22, '#ffd23f', INK, -.1);
    control('MOVE TO CATCH THE EGGS', flash > 0, false, '← → / A D');
  }
  function medal(x, y, T) {
    const k = clamp(S.end / .3); X.save(); X.translate(x, y); X.scale(k, k); X.rotate(Math.sin(T * 5) * .08);
    poly([[-14, 8], [-24, 44], [-12, 36], [-4, 46], [0, 14]], '#ff4d5e', 3); poly([[14, 8], [24, 44], [12, 36], [4, 46], [0, 14]], '#4DB8FF', 3);
    star(0, 0, 26, 14, 9, T * .6, '#FFE14D', 4); celOval(0, 0, 13, 13, '#ffd23f', '#c99512', '#fff3a0', 3); star(0, 0, 8, 3.5, 5, 0, '#fff', 0); X.restore();
    for (let i = 0; i < 3; i++) sparkle(x + Math.cos(T * 4 + i * 2.1) * 36, y + Math.sin(T * 4 + i * 2.1) * 30, 6, '#fff');
  }
  const SCENES = [sceneWipers, sceneSpin, sceneBalance, sceneFrog, sceneDragon, sceneBridge, sceneEggs];
  function draw(v) {
    X = ctx; const { kind, role, progress, c, charge, flash, result, n, end = 0 } = v;
    const T = now || c, won = result === 'win', lost = result === 'lose', gag = Math.min(1, end / .7);
    const seats = Array.from({ length: n }, (_, r) => (v.seats && v.seats[r]) || {}), mates = []; for (let r = 0; r < n; r++) if (r !== role) mates.push(r);
    S = Object.assign({}, v, { T, won, lost, gag, end, seats, mates, act: v.act || Array(n).fill(0), xs: v.xs || Array(n).fill(.5), demo: !!v.demo });
    S.done = r => progress[r] >= 1;
    S.mood = r => won || S.done(r) ? 'happy' : lost ? 'sad' : r === role ? (flash > 0 ? 'happy' : flash < 0 ? 'bonk' : charge > .9 ? 'panic' : 'idle') : S.c > 10 && progress[r] < .6 ? 'panic' : 'idle';
    X.drawImage(background(kind), 0, 0);
    SCENES[kind]();
    if (won && c < 9 && !S.demo) medal(60, 118, T);                    // quick finish bonus: a gold rosette next to the HUD
    if (!S.demo) vignette(.16);
  }
  return { draw };
})();
