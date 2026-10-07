'use strict';
/* PARTY_UI: the DUO art kit for party UI (loaded after js/core.js, before js/party-sab.js and every party file that draws UI).
   Rule: docs/ART-STYLE.md. Thick INK outlines (ink(fill, o) strokes 2*o under the fill), rounded shapes, base/shade/light cel shading with one glint,
   slabs with depth, soft drop shadows, idle motion. Same helpers as js/games/duo/hippo.js (plate, pill, badge, keyCap) promoted into one shared file.

   Everything draws on the global `ctx` unless you point it elsewhere with PARTY_UI.target(c). Text is drawn on that same context
   (the kit has its own text(), same two faces as core txt(): light fill = Arial Black + INK stroke, INK fill = Fredoka + spacing).
   Nothing here touches the game's RNG or Math.random. Motion is a pure function of the time argument `t` (seconds), so a frame is deterministic.
   Paths and measured widths are memoized, gradients are never needed (cel shading only). Every draw function leaves the context state as it found it
   (globalAlpha, lineWidth, font and friends are restored).

   API (all colours are '#rrggbb'; x/y are canvas pixels; sizes in px; t, k in seconds / 0..1)
     target(c) -> previous    draw on context c (an offscreen bake, a test stub); target(null) goes back to the global ctx
     helpers   ease(k) outBack(k) lerp(a,b,k) clamp(v,a,b) mix(hexA,hexB,k) shade(hex,k) lite(hex,k) hash(n) -> 0..1 rng(seed) -> () => 0..1 (mulberry32)
     shapes    rr(x,y,w,h,r) el(x,y,rx,ry,rot) ink(fill,o) inkP(path,fill,o) cel(path,base,shade,sx,sy,o) glint(path,x,y,rx,ry,col,rot) P(svgPathString)
               shadow(x,y,rx,ry,a)       soft drop shadow (stacked ellipses, no gradient)
     text      text(s,x,y,size,fill,align,maxW)
     pill      pill(x,y,label,col,up,size)               name tag with a pointer (down, or up), gloss strip, fully round. Returns its width
     badge     badge(s,x,y,size,bg,fg,sc,rot,maxW)       feedback word slab with gloss + shadow; sc is the pop scale (use outBack(age/.25)), 0 draws nothing
     keyCap    keyCap(x,y,s,o)                           white cap under a label, desktop only (nothing when TOUCH); o = { down, force }
     plate     plate(b,col,dk,down,lit,off)              control slab b = [x,y,w,h]; col may be a preset name (PLATE: green red yellow live blue off); returns the face drop (9-d)
               plateLabel(b,dy,label,key,o)              label + keyCap on a plate; o = { x, size, w, off, fg }; centred with no keyCap on TOUCH
     orb       orb(x,y,r,o)  o = { col, state:'full'|'empty'|'pulse'|'off', t, k (pop 0..1), seed }   chunky glossy inked orb, no digits
               orbRow(cx,y,have,max,r,col,t,o)           a row of orbs, have of max filled; o = { pulse (ready: breathe + ring), at: [fill times], gap }
     dots      dots(cx,y,n,have,o)                       progress pips; o = { r, col, t, at: [fill times], gap }
     toast     toast(cx,y,label,col,o)                   "X SABOTEA A Y" banner; o = { k (pop 0..1), a (alpha), from, to (colours of the two chips), size }
     avatar    avatar(x,y,r,col,o)                       round player portrait, eyes with pupil + highlight, blink, blush. o = { mood, t, look:[x,y], ghost, seed, k, bob }
               moods: idle eager happy sad panic sleepy dizzy bonk smug. ghost: a sheet-ghost body (wavy hem, hollow mouth) that floats
               eye(x,y,r,mood,look,t,k)                  one eye (also exported for characters drawn elsewhere)
     PLATE     { green:[face,base], red, yellow, live, blue, off }                                                                                         */
const PARTY_UI = (function () {
  const TAU = Math.PI * 2;
  const DEF = typeof ctx !== 'undefined' ? ctx : null;
  let X = DEF;
  const target = c => { const prev = X; X = c || DEF; return prev; };
  const tr = s => (typeof t === 'function' ? t(String(s)) : String(s));
  const clock = () => (typeof now === 'number' ? now : 0);
  const touch = () => (typeof TOUCH !== 'undefined' && !!TOUCH);

  /* ───────────── maths ───────────── */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ease = k => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
  const outBack = k => { k = clamp(k, 0, 1) - 1; return 1 + 2.70158 * k * k * k + 1.70158 * k * k; };
  const lerp = (a, b, k) => a + (b - a) * k;
  const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
  const MIXC = Object.create(null);
  const mix = (a, b, k) => {
    const key = a + b + (k * 100 | 0); if (MIXC[key]) return MIXC[key];
    const A = rgb(a), B = rgb(b);
    return (MIXC[key] = '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''));
  };
  const shade = (c, k = .28) => mix(c, '#14101c', k), lite = (c, k = .5) => mix(c, '#ffffff', k);
  const hash = n => { let a = (n | 0) + 0x6D2B79F5 | 0; a = Math.imul(a ^ a >>> 15, a | 1); a ^= a + Math.imul(a ^ a >>> 7, a | 61); return ((a ^ a >>> 14) >>> 0) / 4294967296; };
  const rng = seed => { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let q = Math.imul(a ^ a >>> 15, 1 | a); q = q + Math.imul(q ^ q >>> 7, 61 | q) ^ q; return ((q ^ q >>> 14) >>> 0) / 4294967296; }; };
  const lum = c => { const [r, g, b] = rgb(c); return (.299 * r + .587 * g + .114 * b) / 255; };

  /* ───────────── ink kit (same signatures as the DUO files) ───────────── */
  const PM = Object.create(null);
  const P = d => PM[d] || (PM[d] = new Path2D(d));
  function rr(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath();
  }
  function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); }
  function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
  function inkP(p, fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(p); } if (fill) { X.fillStyle = fill; X.fill(p); } }
  /* base on top of a shifted copy: the shade shows as a crescent on the (sx, sy) side */
  function cel(p, base, shd, sx, sy, o = 4) { inkP(p, shd, o); X.save(); X.clip(p); X.translate(-sx, -sy); X.fillStyle = base; X.fill(p); X.restore(); }
  function glint(p, x, y, rx, ry, col, rot = 0) { X.save(); X.clip(p); X.fillStyle = col; el(x, y, rx, ry, rot); X.fill(); X.restore(); }
  /* soft drop shadow: three stacked ellipses, quietest outermost, so it never needs a gradient */
  function shadow(x, y, rx, ry, a = .28) {
    const g = X.globalAlpha; X.save(); X.fillStyle = INK;
    for (let i = 0; i < 3; i++) { X.globalAlpha = g * a * (.36 + i * .14); el(x, y, rx * (1.18 - i * .18), ry * (1.18 - i * .18)); X.fill(); }
    X.restore();
  }
  /* unit-circle path of radius r, memoized by size */
  const CP = Object.create(null);
  const circP = r => { const k = Math.round(r * 4); return CP[k] || (CP[k] = (() => { const p = new Path2D(); p.arc(0, 0, k / 4, 0, TAU); return p; })()); };

  /* ───────────── text (on X, same two faces as core txt()) ───────────── */
  const WCACHE = Object.create(null);
  function measure(font, s) {
    const key = font + '|' + s; if (WCACHE[key] !== undefined) return WCACHE[key];
    const f0 = X.font; X.font = font; const w = X.measureText(s).width; X.font = f0;
    if (Object.keys(WCACHE).length > 600) for (const k in WCACHE) delete WCACHE[k];
    return (WCACHE[key] = w);
  }
  const fw = (s, size) => measure(`700 ${size}px Fredoka, "Helvetica Neue", Arial, sans-serif`, s) + s.length * Math.max(.5, size / 24);   // INK text: Fredoka + its letter spacing
  function text(s, x, y, size, fill = '#fff', align = 'center', maxW = 0) {
    s = tr(s);
    const dark = fill === INK;
    const face = sz => (dark ? `700 ${sz}px Fredoka, "Helvetica Neue", Arial, sans-serif` : `900 ${sz}px "Arial Black", Impact, sans-serif`);
    if (maxW) { const w = dark ? fw(s, size) : measure(face(size), s); if (w > maxW) size *= maxW / w; }
    X.save();
    X.font = face(size); if ('letterSpacing' in X) X.letterSpacing = dark ? Math.max(.5, size / 24) + 'px' : '0px';
    X.textAlign = align; X.textBaseline = 'middle'; X.lineJoin = 'round';
    if (!dark) { X.lineWidth = size / 5; X.strokeStyle = INK; X.strokeText(s, x, y); }
    X.fillStyle = fill; X.fillText(s, x, y);
    X.restore();
  }

  /* ───────────── name tag, badge, key cap ───────────── */
  /* a name tag with a little pointer; the pointer points at what it names (down by default, `up` flips it) */
  function pill(x, y, label, col, up, size = 17) {
    const s = tr(label);
    const w = Math.min(size * 10, fw(s, size) + size * 1.5), h = size * 1.65, py = up ? -1 : 1;
    X.save();
    X.fillStyle = 'rgba(20,16,28,.22)'; rr(x - w / 2 + 2, y - h / 2 + 5, w, h, h / 2); X.fill();
    X.beginPath(); X.moveTo(x - 9, y + (h / 2 - 1) * py); X.lineTo(x, y + (h / 2 + 10) * py); X.lineTo(x + 9, y + (h / 2 - 1) * py); X.closePath(); ink(col, 3);
    rr(x - w / 2, y - h / 2, w, h, h / 2); ink(col, 3);
    X.fillStyle = 'rgba(255,255,255,.35)'; rr(x - w / 2 + size * .35, y - h / 2 + 3, w - size * .7, h * .24, h * .12); X.fill();
    if (lum(col) < .3) text(label, x, y + 1, size * .9, '#fff', 'center', w - size * .8);
    else text(label, x, y + 1, size, INK, 'center', w - size * .8);
    X.restore();
    return w;
  }
  /* a word on a chunky coloured badge: feedback that stays readable over any background. sc = pop scale */
  function badge(s, x, y, size, bgc, fg, sc = 1, rot = 0, maxW = 236) {
    if (sc <= .01) return;
    const lbl = tr(s), tw = Math.min(maxW, measure(`900 ${size}px "Arial Black", Impact, sans-serif`, lbl)), w = tw + size * 1.15, h = size * 1.6, r = h * .46;
    X.save(); X.translate(x, y); X.rotate(rot || 0); X.scale(sc, sc);
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, r); X.fill();
    rr(-w / 2, -h / 2, w, h, r); ink(bgc, 4);
    X.fillStyle = 'rgba(255,255,255,.32)'; rr(-w / 2 + 12, -h / 2 + 6, w - 24, h * .2, h * .1); X.fill();
    text(s, 0, 2, size, fg || '#fff', 'center', maxW);
    X.restore();
  }
  function keyCap(x, y, s, o = {}) {
    if (touch() && !o.force) return;
    const lbl = tr(s), w = Math.max(26, fw(lbl, 15) + 14), dy = o.down ? 2 : 0;
    X.save();
    rr(x - w / 2, y - 12 + 3, w, 24, 6); ink('#b9b3cc', 2.5);
    rr(x - w / 2, y - 12 + dy, w, 24, 6); ink(o.down ? '#ece9f6' : '#fff', 2.5);
    text(s, x, y + 1 + dy, 15, INK, 'center', w - 6);
    X.restore();
  }

  /* ───────────── control plate ───────────── */
  const PLATE = {
    green: ['#4fd06a', '#24803a'], red: ['#ff4d5e', '#b8283a'], yellow: ['#ffd23f', '#c99512'],
    live: ['#5CFF7A', '#23a046'], blue: ['#4db8ff', '#1f6fc0'], off: ['#d3cfe0', '#8f88a6'],
  };
  /* a chunky slab with depth: the base sits 9 px lower, the face drops to 3 when pressed. `lit` adds a pulsing white ring.
     Draw your icon at y + the returned drop. */
  function plate(b, col, dk, down, lit, off) {
    if (PLATE[col]) { dk = PLATE[col][1]; col = PLATE[col][0]; }
    if (off) { col = PLATE.off[0]; dk = PLATE.off[1]; }
    const [x, y, w, h] = b, d = down ? 3 : 9, r = Math.min(20, h / 2);
    X.save();
    X.fillStyle = 'rgba(20,16,28,.24)'; rr(x + 2, y + 15, w, h, r); X.fill();
    rr(x, y + 9, w, h, r); ink(dk, 4);
    rr(x, y + 9 - d, w, h, r); ink(col, 0);
    X.fillStyle = off ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.28)'; rr(x + 10, y + 13 - d, w - 20, Math.min(12, h * .13), 6); X.fill();
    rr(x, y + 9 - d, w, h, r); X.lineWidth = 5; X.strokeStyle = INK; X.stroke();
    if (lit && !off) { X.strokeStyle = '#fff'; X.lineWidth = 4; X.globalAlpha = .6 + .4 * Math.sin(clock() * 10); rr(x + 7, y + 16 - d, w - 14, h - 14, Math.max(4, r - 5)); X.stroke(); }
    X.restore();
    return 9 - d;
  }
  /* the label (+ key cap under it on desktop) of a plate. dy = what plate() returned. On touch the label is centred and there is no cap. */
  function plateLabel(b, dy, label, key, o = {}) {
    const [x, y, w, h] = b, size = o.size || 28, cx = o.x != null ? o.x : x + w / 2, mw = o.w || w - 24, fg = o.off ? INK : (o.fg || '#fff');
    const withKey = key && !touch();
    X.save(); if (o.off) X.globalAlpha *= .62;   // the pale off face takes dark ink (no outline), faded: readable in every language and still reads as "not now"
    text(label, cx, y + dy + (withKey ? h * .38 : h * .5) + 1, size, fg, 'center', mw);
    if (withKey) keyCap(cx, y + dy + h * .74, key, { down: dy > 5 });
    X.restore();
  }

  /* ───────────── eyes and avatars ───────────── */
  function eye(x, y, r, mood, look, T, k) {
    look = look || [0, 0]; k = k || 0;
    X.save(); X.lineCap = 'round'; X.lineJoin = 'round';
    if (mood === 'happy') { X.lineWidth = r * .55; X.strokeStyle = INK; X.beginPath(); X.arc(x, y + r * .3, r * .75, Math.PI * 1.15, Math.PI * 1.85); X.stroke(); X.restore(); return; }
    if (mood === 'bonk') {
      X.lineWidth = r * .5; X.strokeStyle = INK; X.beginPath();
      if (k) { X.moveTo(x - r * .6, y - r * .6); X.lineTo(x + r * .6, y); X.lineTo(x - r * .6, y + r * .6); } else { X.moveTo(x + r * .6, y - r * .6); X.lineTo(x - r * .6, y); X.lineTo(x + r * .6, y + r * .6); }
      X.stroke(); X.restore(); return;
    }
    const big = mood === 'panic' ? 1.3 : mood === 'eager' ? 1.1 : 1;
    el(x, y, r * big, r * big * 1.08); ink('#fff', Math.max(1.6, r * .26));
    if (mood === 'dizzy') {
      X.strokeStyle = INK; X.lineWidth = Math.max(1.4, r * .2); X.beginPath();
      for (let i = 0; i < 26; i++) { const a = i * .55 * (k ? -1 : 1) + T * 9 * (k ? -1 : 1), q = i / 26 * r * .85; X.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
      X.stroke(); X.restore(); return;
    }
    const sleepy = mood === 'sleepy';
    if (!sleepy && mood !== 'panic' && Math.sin(T * 1.9 + k * .2) > .985) { X.strokeStyle = INK; X.lineWidth = r * .4; X.beginPath(); X.moveTo(x - r * .8, y); X.lineTo(x + r * .8, y); X.stroke(); X.restore(); return; }
    const pr = mood === 'panic' ? r * .34 : r * .52 * big, lx = clamp(look[0], -1, 1) * r * .38, ly = clamp(look[1], -1, 1) * r * .38 + (sleepy ? r * .2 : 0);
    X.fillStyle = INK; el(x + lx, y + ly, pr, pr * 1.1); X.fill();
    X.fillStyle = '#fff'; el(x + lx - pr * .35, y + ly - pr * .4, pr * .35, pr * .3); X.fill();
    if (sleepy) { X.strokeStyle = INK; X.lineWidth = r * .42; X.beginPath(); X.moveTo(x - r * 1.05, y - r * .1); X.lineTo(x + r * 1.05, y - r * .1); X.stroke(); }
    X.restore();
  }
  function brow(x, y, r, a, len = .9) { X.save(); X.strokeStyle = INK; X.lineWidth = Math.max(2, r * .26); X.lineCap = 'round'; X.beginPath(); X.moveTo(x - Math.cos(a) * r * len, y - Math.sin(a) * r * len); X.lineTo(x + Math.cos(a) * r * len, y + Math.sin(a) * r * len); X.stroke(); X.restore(); }
  /* face on a body of radius r centred at (0,0) (the caller translated). */
  function face(r, mood, look, T, ghost, bodyCol) {
    const ex = r * (ghost ? .36 : .34), ey = -r * (ghost ? .12 : .1), er = r * (ghost ? .3 : .27), my = r * (ghost ? .5 : .46);
    X.save(); X.lineCap = 'round'; X.lineJoin = 'round';
    if ((mood === 'happy' || mood === 'eager' || mood === 'smug') && !ghost) { X.fillStyle = 'rgba(255,110,165,.55)'; for (const s of [-1, 1]) { el(s * r * .6, ey + r * .42, r * .17, r * .1); X.fill(); } }
    eye(-ex, ey, er, mood, look, T, 0); eye(ex, ey, er, mood, look, T, 1);
    if (mood === 'eager') { brow(-ex, ey - er * 1.5, er, -.35, .8); brow(ex, ey - er * 1.5, er, .35, .8); }
    else if (mood === 'sad') { brow(-ex, ey - er * 1.45, er, .38, .8); brow(ex, ey - er * 1.45, er, -.38, .8); }
    else if (mood === 'panic') { brow(-ex, ey - er * 1.7, er, .3, .7); brow(ex, ey - er * 1.7, er, -.3, .7); }
    X.strokeStyle = INK; X.lineWidth = Math.max(2.4, r * .13);
    if (ghost) { el(0, my, r * .15, r * (mood === 'panic' ? .24 : mood === 'happy' ? .12 : .19)); X.fillStyle = INK; X.fill(); }
    else if (mood === 'happy') { X.beginPath(); X.arc(0, my - r * .22, r * .26, .15 * Math.PI, .85 * Math.PI); X.stroke(); }
    else if (mood === 'eager') { X.beginPath(); X.moveTo(-r * .2, my - r * .1); X.quadraticCurveTo(0, my + r * .26, r * .2, my - r * .1); X.closePath(); X.fillStyle = INK; X.fill(); X.stroke(); }
    else if (mood === 'sad') { X.beginPath(); X.arc(0, my + r * .2, r * .2, 1.15 * Math.PI, 1.85 * Math.PI); X.stroke(); }
    else if (mood === 'panic') { el(0, my, r * .13, r * .2); X.fillStyle = INK; X.fill(); }
    else if (mood === 'dizzy') { X.beginPath(); for (let i = 0; i <= 8; i++) X.lineTo(-r * .24 + i * r * .06, my + (i % 2 ? -1 : 1) * r * .05); X.stroke(); }
    else if (mood === 'sleepy') { el(r * .05, my, r * .1, r * .12); X.fillStyle = INK; X.fill(); }
    else if (mood === 'bonk') { X.beginPath(); X.moveTo(-r * .2, my); X.lineTo(r * .2, my); X.stroke(); }
    else if (mood === 'smug') { X.beginPath(); X.moveTo(-r * .2, my - r * .04); X.quadraticCurveTo(r * .05, my + r * .12, r * .26, my - r * .12); X.stroke(); }
    else { X.beginPath(); X.arc(0, my - r * .16, r * .2, .2 * Math.PI, .8 * Math.PI); X.stroke(); }
    X.restore();
  }
  function ghostBody(r, T, seed) {
    const p = new Path2D(), bot = r * .95, w3 = r * 2 / 3;
    p.moveTo(-r, bot); p.lineTo(-r, -r * .05); p.arc(0, -r * .05, r, Math.PI, 0); p.lineTo(r, bot);
    for (let i = 0; i < 3; i++) {
      const x2 = r - (i + 1) * w3, x1 = x2 + w3 / 2, wob = Math.sin(T * 4 + i * 1.9 + seed) * r * .1;
      p.quadraticCurveTo(x1, bot + r * .42 + wob, x2, bot - (i === 2 ? 0 : wob * .4));
    }
    p.closePath(); return p;
  }
  /* round player portrait. The body takes the player colour; ghost = a sheet-ghost of that colour (floats, wavy hem, hollow mouth) */
  function avatar(x, y, r, col, o = {}) {
    const T = o.t || 0, seed = o.seed || 0, mood = o.mood || 'idle', ghost = !!o.ghost, look = o.look || [0, 0], k = o.k == null ? 1 : o.k;
    if (k <= .01) return;
    const br = 1 + Math.sin(T * 3.1 + seed) * .025, bob = (o.bob || ghost) ? Math.sin(T * 1.6 + seed) * r * (ghost ? .1 : .06) : 0;
    const ol = Math.max(2.5, r * .15);
    X.save();
    if (ghost) shadow(x, y + r * 1.25, r * .8 * (1 - bob / r * .4), r * .2, .22); else shadow(x + r * .12, y + r * 1.02, r * .8, r * .2, .24);
    X.translate(x, y + bob); X.scale(k * br, k * (2 - br));
    if (ghost) {
      const p = ghostBody(r, T, seed), base = lite(col, .62), shd = lite(col, .22);
      X.save(); X.globalAlpha *= .94;
      cel(p, base, shd, r * .16, r * .22, ol);
      glint(p, -r * .38, -r * .52, r * .3, r * .15, 'rgba(255,255,255,.75)', -.5);
      X.restore();
      face(r, mood === 'idle' ? 'idle' : mood, look, T + seed, true, base);
      X.fillStyle = 'rgba(255,255,255,.7)'; el(r * .5, -r * .52, r * .07, r * .07); X.fill();
    } else {
      const p = circP(r), base = col, shd = shade(col, .3);
      cel(p, base, shd, r * .2, r * .28, ol);
      glint(p, -r * .38, -r * .5, r * .32, r * .15, 'rgba(255,255,255,.55)', -.5);
      face(r, mood, look, T + seed, false, base);
    }
    X.restore();
  }

  /* ───────────── orbs, dots, toast ───────────── */
  /* a chunky glossy orb: charges are orbs, never digits. state full | empty | pulse (full + a ring that breathes out) | off (greyed) */
  function orb(x, y, r, o = {}) {
    const state = o.state || 'full', T = o.t || 0, seed = o.seed || 0, k = o.k == null ? 1 : outBack(o.k);
    if (k <= .01) return;
    const col = o.col || '#FFE14D', ol = Math.max(2.5, r * .2);
    let s = k;
    if (state === 'full') s *= 1 + Math.sin(T * 3.1 + seed) * .03;
    if (state === 'pulse') s *= 1 + (.5 + .5 * Math.sin(T * 8 + seed)) * .1;
    X.save();
    if (state === 'empty') {
      X.translate(x, y); X.scale(s, s);
      const p = circP(r);
      inkP(p, '#5b5378', ol * .9);
      X.save(); X.clip(p); X.fillStyle = '#3a3352'; X.translate(-r * .22, -r * .26); X.fill(p); X.restore();
      X.save(); X.clip(p); X.strokeStyle = 'rgba(255,255,255,.22)'; X.lineWidth = r * .18; X.beginPath(); X.arc(0, 0, r * .8, .15 * Math.PI, .6 * Math.PI); X.stroke(); X.restore();
      X.restore(); return;
    }
    shadow(x + r * .12, y + r * 1.05 * s, r * .85 * s, r * .24 * s, .26);
    if (state === 'pulse') {
      const q = (T * 1.6 + seed) % 1; X.save(); X.globalAlpha *= (1 - q) * .85; X.strokeStyle = lite(col, .6); X.lineWidth = r * .22 * (1 - q) + 1.5;
      X.beginPath(); X.arc(x, y, r * (1.15 + q * .75), 0, TAU); X.stroke(); X.restore();
    }
    X.translate(x, y); X.scale(s, s);
    const base = state === 'off' ? '#d3cfe0' : col, shd = state === 'off' ? '#8f88a6' : shade(col, .3), p = circP(r);
    cel(p, base, shd, r * .22, r * .3, ol);
    if (state !== 'off') {
      X.save(); X.clip(p); X.strokeStyle = lite(col, .38); X.globalAlpha *= .55; X.lineWidth = r * .16; X.beginPath(); X.arc(0, 0, r * .74, 1.05 * Math.PI, 1.6 * Math.PI); X.stroke(); X.restore();
    }
    glint(p, -r * .36, -r * .42, r * .36, r * .2, 'rgba(255,255,255,.8)', -.55);
    glint(p, r * .34, r * .38, r * .07, r * .07, 'rgba(255,255,255,.55)', 0);
    X.restore();
  }
  function orbRow(cx, y, have, max, r, col, T, o = {}) {
    const gap = o.gap || r * 2.55, x0 = cx - (max - 1) * gap / 2;
    for (let i = 0; i < max; i++) {
      const full = i < have, at = o.at && o.at[i];
      const kk = full && at !== undefined ? clamp((T - at) / .3, 0, 1) : 1;
      orb(x0 + i * gap, y, r, { col, t: T, seed: i * .7, k: kk, state: !full ? 'empty' : o.pulse ? 'pulse' : 'full' });
    }
  }
  /* progress pips: a themed row (filled = the player colour with a glint, next = a breathing ring, rest = dark sockets) */
  function dots(cx, y, n, have, o = {}) {
    const r = o.r || 7, gap = o.gap || r * 2.9, col = o.col || '#FFE14D', T = o.t || 0, x0 = cx - (n - 1) * gap / 2;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * gap, full = i < have, at = o.at && o.at[i], k = full ? (at !== undefined ? outBack((T - at) / .3) : 1) : 1;
      if (k <= .01) continue;
      X.save(); X.translate(x, y); X.scale(k, k);
      const p = circP(r);
      if (full) { cel(p, col, shade(col, .3), r * .22, r * .3, Math.max(2, r * .3)); glint(p, -r * .35, -r * .4, r * .35, r * .2, 'rgba(255,255,255,.75)', -.5); }
      else {
        inkP(p, '#4a4266', Math.max(2, r * .3));
        if (i === have) { X.strokeStyle = col; X.globalAlpha *= .55 + .45 * Math.sin(T * 5); X.lineWidth = Math.max(1.5, r * .22); X.beginPath(); X.arc(0, 0, r * .55, 0, TAU); X.stroke(); }
      }
      X.restore();
    }
  }
  /* "X SABOTEA A Y": a fully round banner that pops in (k 0..1), optionally with two colour chips (from -> to) */
  function toast(cx, y, label, col, o = {}) {
    const k = o.k == null ? 1 : outBack(o.k), a = o.a == null ? 1 : o.a;
    if (k <= .01 || a <= .01) return;
    col = col || '#FFE14D';
    const size = o.size || 20, lbl = tr(label), chips = !!(o.from || o.to), cw = chips ? 38 : 0;
    const dk = lum(col) >= .3, w = clamp((dk ? fw(lbl, size) : measure(`900 ${size}px "Arial Black", Impact, sans-serif`, lbl)) + size * 1.9 + cw * 2, 150, 640), h = size * 2.1;
    X.save(); X.globalAlpha *= a; X.translate(cx, y); X.scale(k, k);
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 3, -h / 2 + 7, w, h, h / 2); X.fill();
    rr(-w / 2, -h / 2, w, h, h / 2); ink(col, 4);
    X.fillStyle = 'rgba(255,255,255,.35)'; rr(-w / 2 + h * .35, -h / 2 + 5, w - h * .7, h * .2, h * .1); X.fill();
    text(label, 0, 1, size, dk ? INK : '#fff', 'center', w - size * 1.6 - cw * 2);
    if (chips) {
      const rr0 = h * .36, ax = w / 2 - h * .5 - 4;
      if (o.from) avatar(-ax, 0, rr0, o.from, { t: o.t || 0, mood: 'smug', seed: 1 });
      if (o.to) avatar(ax, 0, rr0, o.to, { t: o.t || 0, mood: 'panic', seed: 2 });
    }
    X.restore();
  }

  return { target, tr, clamp, ease, outBack, lerp, mix, shade, lite, hash, rng, rr, el, ink, inkP, cel, glint, P, shadow, text, pill, badge, keyCap, plate, plateLabel, orb, orbRow, dots, toast, avatar, eye, PLATE };
})();
