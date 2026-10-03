'use strict';
/* SE FUE LA LUZ: art library. Everything here is vector art written as SVG path data (Path2D) and drawn to the game canvas, so it
   stays crisp at any size and can be animated per part (cutout animation, like a 2D TV series): a character is a rig of parts
   (legs, torso, two-bone arms, head, face) that rotate around joints, with cel shading (flat base + one shadow shape + one light
   shape) and thin coloured outlines instead of black ink. Scenes (rooms, the barrio) are layered gradients cached to an offscreen canvas.
   Public API: AP.person(spec, pose, x, y, s), AP.CAST, AP.pose.*, AP.sala/cocina/barrio(...), props: AP.fridge, AP.zancudo, ... */
const AP = (function (MAIN) {
let ctx = MAIN;   // swapped for an offscreen context while a cached scene layer is being painted

/* ───────────── colour + path helpers ───────────── */
const rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.replace(/./g, c => c + c); const n = parseInt(h, 16); return [n >> 16, n >> 8 & 255, n & 255]; };
const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, k) => { const A = rgb(a), B = rgb(b); return hex(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k); };
const SHD = '#2a1740', LGT = '#fff1c9', INKC = '#2a1740';            // shadows lean violet, lights lean warm: the rich "series" look
const dark = (c, k) => mix(c, SHD, k), lite = (c, k) => mix(c, LGT, k);
const memo = {}; const memoK = (k, f) => memo[k] || (memo[k] = f());
const P2 = d => memoK('p' + d, () => new Path2D(d));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k);

/* a cel-shaded shape: base fill, optional shadow / light shapes clipped to it, thin coloured outline */
function sh(d, fill, o = {}) {
  const p = P2(d);
  ctx.fillStyle = fill; ctx.fill(p);
  if (o.sh || o.hl) {
    ctx.save(); ctx.clip(p);
    if (o.sh) { ctx.fillStyle = dark(fill, o.shK || .34); ctx.fill(P2(o.sh)); }
    if (o.hl) { ctx.fillStyle = lite(fill, o.hlK || .32); ctx.fill(P2(o.hl)); }
    ctx.restore();
  }
  if (o.ol !== 0) { const lw = o.lw || 2; ctx.lineWidth = lw * 1.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = o.ol ? mix(o.ol, INKC, .6) : INKC; ctx.stroke(p); }
}
function stroke(d, col, w, cap = 'round') { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = cap; ctx.lineJoin = 'round'; ctx.stroke(P2(d)); }
function ell(x, y, rx, ry, fill, rot = 0, a = 1) { ctx.globalAlpha *= a; ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, 7); ctx.fill(); ctx.globalAlpha /= a; }
function lin(x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach((s, i) => g.addColorStop(s[0], s[1])); return g; }
function rad(x, y, r0, r1, stops) { const g = ctx.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(s => g.addColorStop(s[0], s[1])); return g; }
function at(x, y, rot, sx, sy, f) { ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (sx !== 1 || sy !== 1) ctx.scale(sx, sy); f(); ctx.restore(); }

/* ───────────── the cast ───────────── */
/* spec: skin, hair, hairStyle (short|bun|rolos|cap|bald), outfit (dress|tee|tank), top, bottom, shoe, sleeve (0 none, .5 half, 1 full),
   belly, h (height factor), head (head size factor), brow (colour), stache, glasses, female (lashes), extras */
const CAST = {
  abuela: { name: 'Doña Carmen', skin: '#d99a76', hair: '#d9d6e0', hairStyle: 'bun', outfit: 'dress', top: '#e0627a', pattern: '#ffd9e0', shoe: '#7bc4b4', sleeve: .5, h: .86, head: 1.02, brow: '#a8a2b3', glasses: true, female: true, apron: '#4aa3a0', belly: 0 },
  tio:    { name: 'Tío Pedro', skin: '#c98558', hair: '#2a1d1a', hairStyle: 'short', outfit: 'tee', top: '#a8283c', bottom: '#3f6fb0', shoe: '#f2c14e', sleeve: .45, h: 1, head: 1, brow: '#2a1d1a', stache: true, belly: 1, shorts: true, stripe: '#f4c542' },
  chamo:  { name: 'Luisito', skin: '#e0a47c', hair: '#1e1620', hairStyle: 'cap', outfit: 'tee', top: '#2e9fd0', bottom: '#ece3d0', shoe: '#ef5a3c', sleeve: .45, h: .72, head: 1.16, brow: '#1e1620', cap: '#f5c83a', belly: 0, shorts: true },
  vecina: { name: 'Yolanda', skin: '#b9714d', hair: '#3a2230', hairStyle: 'rolos', outfit: 'dress', top: '#7a5bd0', pattern: '#c7b4ff', shoe: '#ff9fc2', sleeve: .3, h: .94, head: 1, brow: '#3a2230', female: true, rolo: '#ff8fb8', belly: 0, lips: '#d6385c' },
  chuo:   { name: 'Don Chuo', skin: '#b87a54', hair: '#9a948f', hairStyle: 'bald', outfit: 'tank', top: '#efe9dc', bottom: '#3a4466', shoe: '#e8cf8a', sleeve: 0, h: 1.02, head: 1.04, brow: '#7a746f', stache: true, belly: .8, shorts: false }
};

/* poses are plain objects so games can lerp them: arms are [shoulder, elbow] angles (0 = hanging down, + = away from the body / up) */
const POSE = {
  idle: t => ({ bob: Math.sin(t * 2.2) * 1.2, lean: Math.sin(t * 1.1) * .01, la: [.1, .08], ra: [.1, .08], hr: Math.sin(t * 1.3) * .02, eyes: 1, mouth: 'closed' }),
};

/* ───────────── drawing a person ───────────── */
/* pose: bob, lean (rad), squash (1 = none), la/ra: [shoulder, elbow] (rad), hr (head tilt), gx/gy (gaze -1..1), eyes (0..1 open),
   brow (-1 worried .. 1 angry), raise (0..1), mouth: closed|smile|grin|o|yell|worry, talk (0..1 mouth openness), blink (auto if undefined),
   lprop/rprop: fn drawn in the hand's space, sweat (0..1), step (leg swing, rad), sit (0..1) */
function person(spec, pose, x, y, s = 1, flip = false) {
  pose = pose || {};
  const k = s * (spec.h || 1), skin = spec.skin;
  ctx.save(); ctx.translate(x, y); ctx.scale(flip ? -k : k, k);
  const sq = pose.squash || 1, bob = pose.bob || 0;
  const legH = 96;
  const hipY = -legH + bob * .5;
  const lean = pose.lean || 0;

  /* ground shadow */
  ctx.fillStyle = 'rgba(30,18,50,.28)'; ctx.beginPath(); ctx.ellipse(0, 3, 54, 11, 0, 0, 7); ctx.fill();

  /* legs */
  const step = pose.step || 0;
  for (const sd of [-1, 1]) {
    ctx.save(); ctx.translate(sd * 15, hipY + 4); ctx.rotate(sd * step * .5 + (sd < 0 ? 0 : 0));
    const h = legH - 4;
    const legCol = spec.outfit === 'dress' ? skin : (spec.shorts ? skin : spec.bottom);
    if (spec.outfit !== 'dress' && spec.shorts) {
      sh(`M-10,0 L10,0 L9,${h - 6} L-9,${h - 6}Z`, skin, { sh: `M2,0 L10,0 L9,${h} L1,${h}Z`, hl: `M-10,0 L-6,0 L-6,${h} L-9,${h}Z`, hlK: .2 });
      sh(`M-13,-2 L13,-2 L14,${h * .42} L-14,${h * .42}Z`, spec.bottom, { sh: `M3,-2 L13,-2 L14,${h * .42} L4,${h * .42}Z`, hl: `M-13,-2 L-8,-2 L-9,${h * .42} L-14,${h * .42}Z` });
    } else if (spec.outfit === 'dress') {
      sh(`M-8,0 L8,0 L7,${h - 6} L-7,${h - 6}Z`, skin, { sh: `M2,0 L8,0 L7,${h} L1,${h}Z` });
    } else {
      sh(`M-12,-2 L12,-2 L11,${h - 4} L-11,${h - 4}Z`, spec.bottom, { sh: `M3,-2 L12,-2 L11,${h - 4} L4,${h - 4}Z`, hl: `M-12,-2 L-8,-2 L-8,${h} L-11,${h}Z` });
    }
    /* chancleta / shoe */
    const fy = h - 4;
    sh(`M-13,${fy} Q-16,${fy + 11} -6,${fy + 13} L15,${fy + 13} Q23,${fy + 11} 17,${fy + 3} Q4,${fy - 2} -13,${fy}Z`, spec.shoe, { sh: `M-14,${fy + 8} L22,${fy + 8} L22,${fy + 14} L-14,${fy + 14}Z`, ol: dark(spec.shoe, .5) });
    ctx.restore();
  }

  /* torso group, leaning from the hips */
  ctx.save(); ctx.translate(0, hipY); ctx.rotate(lean); ctx.scale(1, sq);
  const sY = -78;                                    // shoulder line relative to hips
  const bel = spec.belly || 0;

  /* arms behind the torso are drawn after; neck first */
  sh(`M-10,${sY - 18} L10,${sY - 18} L12,${sY + 6} L-12,${sY + 6}Z`, skin, { sh: `M-12,${sY - 6} Q0,${sY + 6} 12,${sY - 6} L12,${sY + 6} L-12,${sY + 6}Z`, shK: .4 });

  const topCol = spec.top;
  if (spec.outfit === 'dress') {
    const hem = 100;
    sh(`M-40,${sY} Q-46,${sY + 38} -30,${sY + 76} Q-50,${sY + 120} -${54},${sY + hem + 50} Q0,${sY + hem + 64} 54,${sY + hem + 50} Q50,${sY + 120} 30,${sY + 76} Q46,${sY + 38} 40,${sY} Q0,${sY - 12} -40,${sY}Z`,
      topCol, { sh: `M12,${sY} Q40,${sY + 60} 30,${sY + 76} Q50,${sY + 120} 54,${sY + hem + 50} L20,${sY + hem + 60} Q22,${sY + 100} 8,${sY + 60}Z`, hl: `M-40,${sY} Q-44,${sY + 38} -30,${sY + 76} L-18,${sY + 72} Q-30,${sY + 38} -22,${sY - 4}Z`, lw: 2.2 });
    if (spec.pattern) {                               // little flowers on the bata
      ctx.save(); ctx.clip(P2(`M-40,${sY} Q-46,${sY + 38} -30,${sY + 76} Q-50,${sY + 120} -54,${sY + hem + 50} Q0,${sY + hem + 64} 54,${sY + hem + 50} Q50,${sY + 120} 30,${sY + 76} Q46,${sY + 38} 40,${sY} Q0,${sY - 12} -40,${sY}Z`));
      ctx.fillStyle = spec.pattern;
      for (let i = 0; i < 22; i++) {
        const fx = ((i * 37) % 90) - 45, fy2 = sY + 8 + ((i * 53) % 150), r = 3.4 + (i % 3);
        for (let a = 0; a < 5; a++) { ctx.beginPath(); ctx.arc(fx + Math.cos(a * 1.257) * r, fy2 + Math.sin(a * 1.257) * r, r * .72, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#ffe07a'; ctx.beginPath(); ctx.arc(fx, fy2, r * .5, 0, 7); ctx.fill(); ctx.fillStyle = spec.pattern;
      }
      ctx.restore();
    }
    sh(`M-12,${sY - 2} Q0,${sY + 14} 12,${sY - 2} Q0,${sY + 6} -12,${sY - 2}Z`, dark(skin, .12), { ol: 0 });   // neckline
    if (spec.apron) {
      const a = spec.apron;
      sh(`M-17,${sY + 12} L17,${sY + 12} L22,${sY + 46} L40,${sY + hem + 54} Q0,${sY + hem + 68} -40,${sY + hem + 54} L-22,${sY + 46}Z`, a, { sh: `M8,${sY + 12} L17,${sY + 12} L22,${sY + 46} L40,${sY + hem + 54} L12,${sY + hem + 62} L10,${sY + 46}Z`, hl: `M-17,${sY + 12} L-10,${sY + 12} L-12,${sY + 46} L-30,${sY + hem + 56} L-40,${sY + hem + 54} L-22,${sY + 46}Z`, hlK: .25 });
      stroke(`M-22,${sY + 46} Q0,${sY + 52} 22,${sY + 46}`, dark(a, .5), 3);
      stroke(`M-14,${sY + 12} L-24,${sY - 4} M14,${sY + 12} L24,${sY - 4}`, dark(a, .2), 4);
      sh(`M-14,${sY + 62} L14,${sY + 62} L14,${sY + 84} L-14,${sY + 84}Z`, lite(a, .15), { ol: dark(a, .5), lw: 1.6 });    // bolsillo
    }
  } else {
    const w = 42 + bel * 9, hipW = 40 + bel * 14, bot = 6 + bel * 4;
    const tee = `M${-w},${sY} Q${-w - 4},${sY + 34} ${-hipW},${sY + 82 + bot} Q0,${sY + 90 + bot} ${hipW},${sY + 82 + bot} Q${w + 4},${sY + 34} ${w},${sY} Q0,${sY - 12} ${-w},${sY}Z`;
    if (spec.outfit === 'tank') {
      sh(tee, skin, { ol: dark(skin, .5) });                                  // bare shoulders under the camisilla
      sh(`M-30,${sY - 4} Q-34,${sY + 40} ${-hipW},${sY + 82 + bot} Q0,${sY + 90 + bot} ${hipW},${sY + 82 + bot} Q34,${sY + 40} 30,${sY - 4} Q16,${sY + 24} 0,${sY + 24} Q-16,${sY + 24} -30,${sY - 4}Z`, topCol,
        { sh: `M10,${sY + 20} Q30,${sY + 30} 30,${sY + 40} Q40,${sY + 60} ${hipW},${sY + 82 + bot} L8,${sY + 90 + bot}Z`, hl: `M-30,${sY - 4} Q-34,${sY + 40} -34,${sY + 60} L-22,${sY + 50} Q-26,${sY + 20} -22,${sY + 6}Z` });
      if (spec.chest !== false) { ctx.globalAlpha = .55; ell(0, sY + 30, 16, 6, dark(skin, .35)); ctx.globalAlpha = 1; }
    } else {
      sh(tee, topCol, { sh: `M${w * .35},${sY} Q${w + 4},${sY + 34} ${hipW},${sY + 82 + bot} L${hipW * .1},${sY + 92 + bot} Q${w * .5},${sY + 50} ${w * .2},${sY}Z`, hl: `M${-w},${sY} Q${-w - 4},${sY + 34} ${-hipW},${sY + 82 + bot} L${-hipW + 12},${sY + 80 + bot} Q${-w + 10},${sY + 34} ${-w + 12},${sY - 4}Z`, lw: 2.2 });
      if (spec.stripe) { ctx.save(); ctx.clip(P2(tee)); ctx.fillStyle = spec.stripe; ctx.fillRect(-60, sY + 24, 120, 10); ctx.fillStyle = dark(spec.stripe, .0); ctx.restore(); }
      sh(`M-14,${sY - 3} Q0,${sY + 16} 14,${sY - 3} Q0,${sY + 8} -14,${sY - 3}Z`, dark(skin, .1), { ol: 0 });     // round collar
      stroke(`M-15,${sY - 4} Q0,${sY + 14} 15,${sY - 4}`, dark(topCol, .5), 3);
    }
    /* belt / waistband */
    if (spec.outfit !== 'dress' && spec.bottom) { ctx.save(); ctx.clip(P2(tee)); ctx.fillStyle = dark(spec.bottom, .1); ctx.fillRect(-60, sY + 74 + bot, 120, 20); ctx.restore(); }
  }

  /* arms: rubber-hose noodles (one smooth curve through the elbow), not stiff sticks. Same [shoulder, elbow] angle contract as before. */
  const arm = (sd, ang, prop) => {
    ctx.save(); ctx.translate(sd * (spec.outfit === 'dress' ? 36 : 38 + bel * 5), sY + 8);
    const a1 = (ang && ang[0] || 0), a2 = (ang && ang[1] || 0), L1 = 56, L2 = 52;
    const ex = sd * Math.sin(a1) * L1, ey = Math.cos(a1) * L1, d2 = a1 - a2, wx = ex + sd * Math.sin(d2) * L2, wy = ey + Math.cos(d2) * L2;
    const phi2 = sd * (a2 - a1), sl = spec.sleeve || 0, sleeveCol = spec.top, thick = 17 + (spec.belly ? 2 : 0);
    const curve = (t0, t1) => {   // sub-curve of the quadratic (0,0) -> (ex,ey) -> (wx,wy)
      const pt = t => ({ x: 2 * (1 - t) * t * ex + t * t * wx, y: 2 * (1 - t) * t * ey + t * t * wy }), q = t => ({ x: 2 * t * ex * (1 - t) * 0, y: 0 });
      const A = pt(t0), B = pt(t1), mid = pt((t0 + t1) / 2);
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo(2 * mid.x - (A.x + B.x) / 2, 2 * mid.y - (A.y + B.y) / 2, B.x, B.y);
    };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    curve(0, 1); ctx.strokeStyle = INKC; ctx.lineWidth = thick + 7; ctx.stroke();
    if (sl > 0 && spec.outfit !== 'tank') { curve(0, .3 + sl * .5); ctx.strokeStyle = INKC; ctx.lineWidth = thick + 12; ctx.stroke(); }
    curve(0, 1); ctx.strokeStyle = spec.skin; ctx.lineWidth = thick; ctx.stroke();
    curve(0, 1); ctx.strokeStyle = dark(spec.skin, .22); ctx.lineWidth = 4; ctx.save(); ctx.translate(sd * 4, 0); ctx.globalAlpha = .6; ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1;
    if (sl > 0 && spec.outfit !== 'tank') { curve(0, .3 + sl * .5); ctx.strokeStyle = sleeveCol; ctx.lineWidth = thick + 5; ctx.stroke(); curve(0, .3 + sl * .5); ctx.strokeStyle = dark(sleeveCol, .3); ctx.lineWidth = 3; ctx.save(); ctx.translate(sd * 5, 0); ctx.globalAlpha = .6; ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1; }
    // hand: a big comic mitten with a thumb
    ctx.save(); ctx.translate(wx, wy); ctx.rotate(phi2);
    sh('M-10,-4 C-15,12 -13,28 0,31 C13,28 15,12 10,-4Z', spec.skin, { sh: 'M3,0 C12,14 12,26 0,31 C13,28 15,12 10,-4Z', lw: 2.4 });
    sh('M7,6 C19,5 22,16 16,25 C13,19 10,15 7,14Z', spec.skin, { lw: 2.2 });
    for (const fx of [-4, 3]) stroke(`M${fx},18 L${fx},27`, dark(spec.skin, .35), 1.8);
    if (prop) { ctx.save(); ctx.translate(0, 22); prop(lean + phi2); ctx.restore(); }
    ctx.restore();
    ctx.restore();
  };
  arm(-1, pose.la || [.1, .08], pose.lprop);
  arm(1, pose.ra || [.1, .08], pose.rprop);

  /* head */
  ctx.save(); ctx.translate(0, sY - 14); ctx.rotate(-lean * .6 + (pose.hr || 0));
  const hs = (spec.head || 1) * 1.14; ctx.scale(hs, hs); ctx.translate(0, -44);
  head(spec, pose);
  ctx.restore();
  ctx.restore();   // torso
  ctx.restore();   // person
}

/* ───────────── head + face: telenovela / comic latino ─────────────
   Big, theatrical faces: heavy ink lids that carry the mood, fat brows, a big nose, a big mouth, plus the comic shorthand
   (sweat drops flying off, an anger vein, shock lines). */
function head(spec, pose) {
  const skin = spec.skin, hair = spec.hair, t = now, skinD = dark(skin, .3);
  /* hair behind */
  if (spec.hairStyle === 'bun') {
    sh('M-41,-6 C-47,-52 -20,-62 0,-62 C22,-62 47,-52 41,-6 C41,24 30,34 20,34 L-20,34 C-30,34 -41,24 -41,-6Z', dark(hair, .1), { ol: dark(hair, .5) });
    sh('M-19,-66 A19,17 0 1 0 19,-66 A19,17 0 1 0 -19,-66Z', hair, { hl: 'M-17,-72 Q0,-84 14,-74 Q0,-70 -17,-62Z', lw: 2.6 });
    ctx.strokeStyle = dark(hair, .3); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -66, 11, .4, 3.4); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -66, 6, 3, 6); ctx.stroke();
  } else if (spec.hairStyle === 'rolos') {
    sh('M-43,-4 C-52,-54 -20,-65 0,-65 C22,-65 52,-54 43,-4 C48,30 38,44 26,44 L-26,44 C-38,44 -48,30 -43,-4Z', dark(hair, .05), { ol: dark(hair, .5) });
  } else if (spec.hairStyle === 'short' || spec.hairStyle === 'cap') {
    sh('M-40,-10 C-45,-48 -20,-57 0,-57 C20,-57 45,-48 40,-10 L37,4 L-37,4Z', hair, { ol: dark(hair, .5) });
  }
  /* ears */
  for (const sd of [-1, 1]) { sh(`M${sd * 38},-8 C${sd * 52},-10 ${sd * 52},14 ${sd * 38},14Z`, skin, { lw: 2.6 }); stroke(`M${sd * 41},-1 Q${sd * 47},2 ${sd * 41},8`, skinD, 2); }
  /* face: a wider, more caricatured jaw */
  const face = 'M0,-46 C24,-46 41,-32 41,-6 C41,16 33,36 14,44 Q0,50 -14,44 C-33,36 -41,16 -41,-6 C-41,-32 -24,-46 0,-46Z';
  sh(face, skin, { sh: 'M41,-8 C41,16 33,36 14,44 Q4,48 -4,47 C18,36 28,12 26,-16 C32,-24 38,-20 41,-8Z', hl: 'M-41,-8 C-41,-32 -24,-46 0,-46 C-14,-40 -28,-26 -30,-4 C-31,10 -27,24 -21,32 C-34,24 -41,8 -41,-8Z', hlK: .16, lw: 3 });
  ctx.save(); ctx.clip(P2(face)); ctx.fillStyle = 'rgba(42,23,64,.2)'; ctx.fillRect(-42, -48, 84, 14);
  /* comic halftone shadow under the chin */
  ctx.fillStyle = 'rgba(42,23,64,.16)'; for (let r = 0; r < 3; r++) for (let q = -3; q <= 3; q++) { ctx.beginPath(); ctx.arc(q * 9 + (r % 2) * 4.5, 36 + r * 5, 1.8, 0, 7); ctx.fill(); }
  ctx.restore();
  /* cheeks: three hatch strokes, the telenovela blush */
  const blush = spec.female ? 'rgba(255,90,130,.55)' : 'rgba(255,100,90,.5)', bl = pose.blush == null ? .7 : pose.blush;
  ctx.strokeStyle = blush; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.globalAlpha = bl;
  for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(sd * (26 + i * 5) - 3, 20 + 1); ctx.lineTo(sd * (26 + i * 5) + 2, 14); ctx.stroke(); }
  ctx.globalAlpha = 1;
  /* nose: big, round, outlined */
  sh('M-3,-8 C-11,6 -14,13 -7,17 C0,20 8,17 10,12 C11,6 6,0 3,-8Z', lite(skin, .06), { sh: 'M4,-4 C9,4 12,10 10,12 C8,17 0,20 -3,18 C6,14 8,4 4,-4Z', hl: 'M-6,2 Q-9,10 -5,14', hlK: .3, lw: 2.8 });
  ell(-3, 15, 1.8, 1.4, skinD); ell(5, 15, 1.8, 1.4, skinD);

  /* eyes */
  const open = pose.eyes == null ? 1 : pose.eyes, wide = pose.wide || 0, br = pose.brow || 0;
  const blk = pose.blink != null ? pose.blink : (Math.sin(t * 1.9 + (spec.h || 1) * 7) > .985 ? 0 : 1);
  const gx = pose.gx || 0, gy = pose.gy || 0;
  for (const sd of [-1, 1]) {
    const ex = sd * 18, ey = -7, rx = 14 * (1 + .1 * wide), ry = 11.5 * (1 + .3 * wide);
    ctx.save(); ctx.translate(ex, ey);
    const eye = new Path2D(); eye.ellipse(0, 0, rx, ry, 0, 0, 7);
    ctx.fillStyle = '#fffdf6'; ctx.fill(eye);
    ctx.save(); ctx.clip(eye);
    const ix = gx * 4.5, iy = gy * 2.8, ir = 7 - wide * 1.6;
    ell(ix, iy, ir, ir, spec.eye || '#4a2a18'); ell(ix, iy, ir * .5, ir * .5, '#100810'); ell(ix - 2.4, iy - 2.8, 2.6, 2.6, '#fff'); ell(ix + 2.4, iy + 2.4, 1.2, 1.2, '#fff', 0, .8);
    /* the lid: skin-coloured cover that comes down from above, slanted by the mood (angry in, worried out) */
    const cover = clamp((1 - open * blk) * 2 * ry * .95, 0, ry * 2.1) + Math.abs(br) * 5, slant = br * 8, yb = -ry + cover, yi = yb + slant, yo = yb - slant;   // inner / outer lid edge
    const rY = sd < 0 ? yi : yo, lY = sd < 0 ? yo : yi;
    ctx.fillStyle = skin; ctx.beginPath(); ctx.moveTo(-rx - 3, -ry - 6); ctx.lineTo(rx + 3, -ry - 6); ctx.lineTo(rx + 3, rY); ctx.lineTo(-rx - 3, lY); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = INKC; ctx.lineWidth = 2.2; ctx.stroke(eye);
    /* heavy lid line */
    if (cover > 1) { ctx.lineWidth = 4.6; ctx.beginPath(); ctx.moveTo(-rx, lY); ctx.lineTo(rx, rY); ctx.stroke(); }
    else { ctx.lineWidth = 4.4; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke(); }
    if (spec.female) { ctx.lineWidth = 2.6; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(sd * (rx - 1 + i * .5), -ry * .55 + i * 3); ctx.lineTo(sd * (rx + 5 + i * 1.5), -ry - 3 + i * 5); ctx.stroke(); } }
    ctx.restore();
  }
  /* brows: fat, mobile, the whole telenovela range */
  const rs = pose.raise || 0, bc = spec.brow || hair;
  for (const sd of [-1, 1]) {
    const iy = -29 + br * 6 - rs * 8, oy = -28 - br * 4 - rs * 6, mid = Math.min(iy, oy) - 5 - rs * 2;
    ctx.strokeStyle = INKC; ctx.lineWidth = 8.4; ctx.beginPath(); ctx.moveTo(sd * 6, iy); ctx.quadraticCurveTo(sd * 18, mid, sd * 31, oy + 3); ctx.stroke();
    ctx.strokeStyle = bc; ctx.lineWidth = 5.2; ctx.stroke();
  }
  /* glasses */
  if (spec.glasses) {
    ctx.strokeStyle = '#5a3a68'; ctx.lineWidth = 3;
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 18, -7, 17, 16, 0, 0, 7); ctx.stroke(); ctx.fillStyle = 'rgba(200,230,255,.14)'; ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(sd * 18 - 5, -14, 5, 2.4, -.5, 0, 7); ctx.fill(); }
    ctx.beginPath(); ctx.moveTo(-2, -8); ctx.quadraticCurveTo(0, -12, 2, -8); ctx.stroke();
  }
  /* mustache */
  if (spec.stache) sh('M0,19 Q-10,12 -22,18 Q-27,28 -15,25 Q-6,22 0,23 Q6,22 15,25 Q27,28 22,18 Q10,12 0,19Z', spec.hair, { ol: INKC, lw: 2.2, sh: 'M0,21 Q8,21 15,25 Q22,28 27,25 L0,29Z' });
  mouth(spec, pose);
  hairFront(spec, pose);
  /* comic shorthand */
  if (pose.sweat) for (let i = 0; i < 3; i++) {
    const u = (t * 1.1 + i / 3) % 1, sd = i === 1 ? 1 : -1, sx = sd * (46 + u * 22), sy = -40 - u * 10 + u * u * 34 - (i === 2 ? 14 : 0);
    ctx.globalAlpha = Math.sin(Math.min(1, u) * 3.14) * clamp(pose.sweat, 0, 1);
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(sd * .5);
    sh('M0,-9 Q7,2 0,8 Q-7,2 0,-9Z', '#aee6ff', { hl: 'M-2,-2 Q-4,3 -1,5', lw: 2.2 }); ctx.restore(); ctx.globalAlpha = 1;
  }
  if (br > .7 || pose.rage) {            // anger vein
    const k = 1 + Math.sin(t * 14) * .12; ctx.save(); ctx.translate(30, -42); ctx.scale(k, k); ctx.strokeStyle = '#e8303a'; ctx.lineWidth = 3.2;
    for (const [x0, y0, x1, y1] of [[-7, -5, -2, -2], [7, -5, 2, -2], [-7, 5, -2, 2], [7, 5, 2, 2]]) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 * .3, y0 * .2, x1, y1); ctx.stroke(); }
    ctx.restore();
  }
  if (wide > .6) {                       // shock lines
    ctx.strokeStyle = INKC; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) { const a = -1.25 + i * .5; ctx.beginPath(); ctx.moveTo(sd * (50 + Math.cos(a) * 8), -34 + Math.sin(a) * 20); ctx.lineTo(sd * (50 + Math.cos(a) * 20), -34 + Math.sin(a) * 36); ctx.stroke(); }
  }
}
function mouth(spec, pose) {
  const m = pose.mouth || 'closed', talk = pose.talk == null ? 0 : pose.talk, lipC = spec.lips || '#c95a5a', y = 31;
  const inner = '#4a0f1e', ink = INKC;
  const fillMouth = (p, teeth, tongue) => {
    ctx.fillStyle = inner; ctx.fill(P2(p)); ctx.save(); ctx.clip(P2(p));
    if (teeth) { ctx.fillStyle = '#fffdf6'; ctx.fillRect(-30, teeth[0], 60, teeth[1]); ctx.strokeStyle = 'rgba(42,23,64,.5)'; ctx.lineWidth = 1.4; for (let x = -12; x <= 12; x += 8) { ctx.beginPath(); ctx.moveTo(x, teeth[0]); ctx.lineTo(x, teeth[0] + teeth[1]); ctx.stroke(); } }
    if (tongue) { ctx.fillStyle = '#ee5a72'; ctx.beginPath(); ctx.ellipse(tongue[0], tongue[1], tongue[2], tongue[3], 0, 0, 7); ctx.fill(); }
    ctx.restore(); stroke(p, ink, 3.4);
  };
  if (m === 'yell' || m === 'o' || talk > .08) {
    const open = m === 'o' ? .8 : m === 'yell' ? Math.max(.65, talk) : talk, w = m === 'o' ? 8 : 17, hgt = (m === 'o' ? 13 : 22) * Math.max(.25, open);
    const p = m === 'o' ? `M0,${y - hgt * .6} C${w},${y - hgt * .6} ${w},${y + hgt} 0,${y + hgt} C${-w},${y + hgt} ${-w},${y - hgt * .6} 0,${y - hgt * .6}Z`
      : `M${-w},${y - 5} Q0,${y - 11} ${w},${y - 5} Q${w - 2},${y + hgt} 0,${y + hgt} Q${-w + 2},${y + hgt} ${-w},${y - 5}Z`;
    fillMouth(p, m === 'o' ? null : [y - 4, 8], [0, y + hgt, w * .7, hgt * .42]);
  } else if (m === 'grin') {
    fillMouth(`M-18,${y - 4} Q0,${y + 3} 18,${y - 4} Q16,${y + 15} 0,${y + 15} Q-16,${y + 15} -18,${y - 4}Z`, [y - 4, 10], null);
  } else if (m === 'smile') {
    stroke(`M-15,${y - 3} Q0,${y + 13} 15,${y - 3}`, ink, 4.4); stroke(`M-15,${y - 3} Q0,${y + 13} 15,${y - 3}`, lipC, 1.6);
    stroke(`M-19,${y - 6} L-16,${y - 2} M19,${y - 6} L16,${y - 2}`, ink, 2.4);
  } else if (m === 'worry') {
    stroke(`M-14,${y + 6} Q-7,${y - 4} 0,${y + 3} Q7,${y - 4} 14,${y + 6}`, ink, 4.2);
  } else {
    stroke(`M-12,${y + 1} Q0,${y + 5} 12,${y + 1}`, ink, 4.2);
  }
  if (spec.lips && m !== 'yell') { ctx.globalAlpha = .7; stroke(`M-13,${y + 1} Q0,${y + 6} 13,${y + 1}`, spec.lips, 7); ctx.globalAlpha = 1; }
}
function hairFront(spec, pose) {
  const hair = spec.hair, hs = spec.hairStyle;
  if (hs === 'short') {
    sh('M-41,-8 C-45,-42 -22,-56 0,-56 C22,-56 45,-42 41,-8 C36,-28 24,-33 10,-33 C-2,-27 -22,-28 -41,-8Z', hair, { ol: dark(hair, .5), hl: 'M-30,-44 Q-10,-56 14,-52 Q-8,-48 -30,-34Z', hlK: .22 });
  } else if (hs === 'bun') {
    sh('M-41,-6 C-46,-42 -22,-55 0,-55 C22,-55 46,-42 41,-6 C38,-26 28,-34 14,-34 C8,-26 -10,-28 -41,-6Z', hair, { ol: dark(hair, .5), hl: 'M-30,-44 Q-10,-56 14,-52 Q-8,-48 -30,-34Z', hlK: .3 });
  } else if (hs === 'rolos') {
    sh('M-42,-8 C-46,-44 -22,-58 0,-58 C22,-58 46,-44 42,-8 C36,-28 24,-34 8,-34 C-8,-30 -24,-30 -42,-8Z', hair, { ol: dark(hair, .5), hl: 'M-32,-46 Q-10,-58 14,-54 Q-8,-50 -32,-36Z', hlK: .2 });
    for (let i = 0; i < 5; i++) {
      const a = -2.55 + i * .5, rx = Math.cos(a) * 36, ry = Math.sin(a) * 38 - 12;
      at(rx, ry, a + 1.57 + Math.PI, 1, 1, () => {
        const c = spec.rolo || '#ff8fb8';
        sh('M-8,-12 L8,-12 Q10,0 8,12 L-8,12 Q-10,0 -8,-12Z', c, { sh: 'M2,-12 L8,-12 Q10,0 8,12 L2,12Z', hl: 'M-8,-12 L-4,-12 L-4,12 L-8,12Z', lw: 1.8 });
        ctx.strokeStyle = dark(c, .45); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(8, -3); ctx.moveTo(-8, 4); ctx.lineTo(8, 4); ctx.stroke();
        ell(0, -12, 8, 3, lite(c, .4)); ell(0, 12, 8, 3, dark(c, .2));
      });
    }
  } else if (hs === 'cap') {
    const c = spec.cap || '#f5c83a';
    sh('M-43,-12 C-46,-52 -22,-64 0,-64 C22,-64 46,-52 43,-12 Q0,-26 -43,-12Z', c, { sh: 'M12,-64 C40,-56 46,-40 43,-12 L16,-20Z', hl: 'M-30,-52 Q-10,-64 14,-60 Q-8,-56 -30,-42Z', lw: 2.2 });
    sh('M-46,-12 Q0,-2 46,-12 Q44,-24 0,-28 Q-44,-24 -46,-12Z', dark(c, .18), { sh: 'M-46,-12 Q0,-2 46,-12 L46,-6 Q0,6 -46,-6Z', shK: .3, lw: 2.2 });
    ell(0, -42, 8, 8, '#e8433a'); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -42, 4, 0, 7); ctx.stroke();
  } else if (hs === 'bald') {
    for (const sd of [-1, 1]) sh(`M${sd * 38},-16 C${sd * 42},-4 ${sd * 41},8 ${sd * 37},13 C${sd * 36},6 ${sd * 35},-4 ${sd * 35},-14Z`, hair, { ol: dark(hair, .5), lw: 1.4 });
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-14, -37); ctx.quadraticCurveTo(-4, -43, 8, -42); ctx.stroke();
  }
}

/* ───────────── small pose helpers ───────────── */
const talkAmt = (t, sp = 12) => Math.max(0, Math.sin(t * sp) * .5 + .45);

/* ───────────── scenes: layered, painted once into an offscreen canvas, then blitted ─────────────
   A scene canvas is 1440 wide (the widest screen the game allows) and is drawn at x = -320, so the 800-wide play area sits in the middle. */
const SW = 1440, SHT = 600, SX = -320;
function offscreen(w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const prev = ctx; ctx = c.getContext('2d');
  try { fn(); } finally { ctx = prev; }
  return c;
}
const rnd = seed => mulberry32(seed);
const layerOf = (key, fn) => memoK('L' + key, () => offscreen(SW, SHT, fn));
const blit = c => ctx.drawImage(c, SX, 0);

/* a night barrio seen through a window or from the street. dim 0 = dusk, 1 = deep night */
function skyAndHills(dim, h0) {
  const g = lin(0, 0, 0, h0, dim > .5 ? [[0, '#0a0826'], [.55, '#241552'], [1, '#5d2f6e']] : [[0, '#3a2a78'], [.5, '#c4577e'], [1, '#ffb36b']]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, h0);
  const R = rnd(7);
  if (dim > .5) { ctx.fillStyle = '#fff'; for (let i = 0; i < 90; i++) { ctx.globalAlpha = .25 + R() * .6; ctx.beginPath(); ctx.arc(R() * SW, R() * h0 * .6, .6 + R() * 1.3, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }
  /* moon */
  const mx = 1030, my = h0 * .2;
  ctx.fillStyle = rad(mx, my, 6, 120, [[0, 'rgba(255,240,200,.5)'], [1, 'rgba(255,240,200,0)']]); ctx.fillRect(mx - 130, my - 130, 260, 260);
  ell(mx, my, 24, 24, '#fff4d6'); ell(mx - 8, my - 4, 5, 5, '#e8dcb8'); ell(mx + 8, my + 7, 3.4, 3.4, '#e8dcb8');
  /* the Ávila: two layers of mountain with a rim light */
  const mt = (base, amp, col, rim, seed) => {
    const r = rnd(seed); ctx.beginPath(); ctx.moveTo(0, h0);
    let y = base; for (let x = 0; x <= SW; x += 40) { y = base - amp * (.5 + .5 * Math.sin(x * .004 + seed) + .35 * Math.sin(x * .011 + seed * 2)) + r() * 6; ctx.lineTo(x, y); }
    ctx.lineTo(SW, h0); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = rim; ctx.lineWidth = 2; ctx.stroke();
  };
  mt(h0 * .66, 90, dim > .5 ? '#1a1240' : '#6a3b78', dim > .5 ? 'rgba(160,140,255,.35)' : 'rgba(255,200,150,.5)', 3);
  mt(h0 * .78, 70, dim > .5 ? '#120c30' : '#4b2a62', dim > .5 ? 'rgba(130,110,230,.3)' : 'rgba(255,170,130,.4)', 5);
}
/* the hillside of ranchitos: coloured block houses climbing the cerro. Windows are returned so they can be lit dynamically. */
const BARRIO_WINDOWS = [];
function hillside(dim, ground) {
  const R = rnd(11), cols = ['#e8805c', '#4bb8b0', '#f2c14e', '#6fa8e8', '#e86a8f', '#9bd36b', '#f0a05a', '#b48ae8'];
  const wins = []; const rows = 5;
  for (let r = 0; r < rows; r++) {
    const baseY = ground - 34 - r * 32 - (r * r) * .8;
    for (let x = -30 + (r % 2) * 40; x < SW + 30; x += 70 + R() * 26) {
      const w = 54 + R() * 30, h = 32 + R() * 26, y = baseY - h, c = cols[(R() * cols.length) | 0];
      const dk = dim > .5 ? .72 : .38;
      sh(`M${x},${baseY} L${x},${y} L${x + w},${y} L${x + w},${baseY}Z`, dark(c, dk), { sh: `M${x + w * .6},${y} L${x + w},${y} L${x + w},${baseY} L${x + w * .6},${baseY}Z`, shK: .3, ol: dark(c, dk + .1), lw: 1.4 });
      /* zinc roof + water tank + dish */
      sh(`M${x - 5},${y} L${x + w + 5},${y} L${x + w + 2},${y - 7} L${x - 2},${y - 7}Z`, dark('#9aa0b4', dim > .5 ? .65 : .3), { ol: dark('#9aa0b4', .7), lw: 1.2 });
      if (R() < .35) { sh(`M${x + 8},${y - 7} L${x + 8},${y - 24} L${x + 28},${y - 24} L${x + 28},${y - 7}Z`, dark('#3c8cd8', dim > .5 ? .6 : .25), { ol: dark('#3c8cd8', .7), lw: 1.2 }); ell(x + 18, y - 25, 10, 3, dark('#3c8cd8', dim > .5 ? .5 : .15)); }
      else if (R() < .35) { stroke(`M${x + w - 16},${y - 7} L${x + w - 16},${y - 16}`, '#445', 1.6); ell(x + w - 16, y - 20, 8, 6, dark('#d9d9e4', dim > .5 ? .6 : .3), -.5); }
      const nw = 1 + (w > 70 ? 1 : 0);
      for (let i = 0; i < nw; i++) wins.push({ x: x + 9 + i * 28, y: y + 9, w: 14, h: 15, th: R(), warm: R() < .5, cand: R() < .15 });
    }
  }
  return wins;
}
function pole(x, base, top, col) {
  sh(`M${x - 6},${base} L${x - 5},${top} L${x + 5},${top} L${x + 6},${base}Z`, col, { sh: `M${x + 1},${top} L${x + 5},${top} L${x + 6},${base} L${x + 1},${base}Z`, ol: dark(col, .5), lw: 1.5 });
  sh(`M${x - 34},${top + 14} L${x + 34},${top + 14} L${x + 34},${top + 20} L${x - 34},${top + 20}Z`, col, { ol: dark(col, .5), lw: 1.5 });
  sh(`M${x - 24},${top + 38} L${x + 24},${top + 38} L${x + 24},${top + 43} L${x - 24},${top + 43}Z`, col, { ol: dark(col, .5), lw: 1.5 });
  for (const ix of [-30, -12, 12, 30]) { ell(x + ix, top + 12, 4, 5, '#cfe8e0'); }
  /* transformer */
  sh(`M${x + 8},${top + 56} L${x + 40},${top + 56} L${x + 40},${top + 100} L${x + 8},${top + 100}Z`, '#7b8696', { sh: `M${x + 28},${top + 56} L${x + 40},${top + 56} L${x + 40},${top + 100} L${x + 28},${top + 100}Z`, hl: `M${x + 8},${top + 56} L${x + 14},${top + 56} L${x + 14},${top + 100} L${x + 8},${top + 100}Z`, ol: '#2b3040', lw: 1.6 });
  for (let i = 0; i < 4; i++) stroke(`M${x + 8},${top + 64 + i * 9} L${x + 40},${top + 64 + i * 9}`, '#59627a', 1.6);
}
const WIRES = [];     // [x0,y0,x1,y1,sag]
function wire(x0, y0, x1, y1, sag, col = '#14101f', w = 1.8) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + sag, x1, y1); ctx.stroke();
}
function barrioBase(dim) {
  const gr = 470;
  skyAndHills(dim, gr);
  const wins = hillside(dim, gr + 30);
  /* haze at the foot of the hill */
  ctx.fillStyle = lin(0, gr - 120, 0, gr + 30, [[0, 'rgba(255,140,120,0)'], [1, dim > .5 ? 'rgba(90,50,120,.45)' : 'rgba(255,150,110,.5)']]); ctx.fillRect(0, gr - 120, SW, 150);
  /* street */
  ctx.fillStyle = lin(0, gr, 0, SHT, [[0, dim > .5 ? '#1c1836' : '#463a63'], [1, dim > .5 ? '#0f0c22' : '#2a2144']]); ctx.fillRect(0, gr, SW, SHT - gr);
  ctx.fillStyle = dim > .5 ? '#2d2650' : '#6a5a88'; ctx.fillRect(0, gr, SW, 7);                 // curb
  ctx.fillStyle = 'rgba(255,225,120,.28)'; for (let x = 20; x < SW; x += 150) ctx.fillRect(x, 548, 70, 6);   // road paint
  /* poles + the famous tangle of cables */
  const R = rnd(21);
  for (const px of [180, 640, 1120]) pole(px, gr + 8, 150 + (px % 3) * 12, '#3a3248');
  for (let i = 0; i < 9; i++) for (const [a, b] of [[180, 640], [640, 1120], [1120, 1500], [-80, 180]]) wire(a + (i % 3) * 8 - 30, 164 + i * 7, b + (i % 3) * 8 - 30, 162 + i * 8 + R() * 8, 40 + R() * 30);
  /* palm silhouettes */
  for (const px of [420, 900, 1340]) {
    const th = 180 + (px % 5) * 8; stroke(`M${px},${gr + 6} Q${px + 10},${gr - th / 2} ${px + 4},${gr - th}`, dark('#2c6a4a', dim > .5 ? .7 : .4), 7);
    for (let i = 0; i < 7; i++) { const a = -2.9 + i * .52; stroke(`M${px + 4},${gr - th} Q${px + 4 + Math.cos(a) * 34},${gr - th + Math.sin(a) * 20 - 14} ${px + 4 + Math.cos(a) * 64},${gr - th + Math.sin(a) * 40 + 10}`, dark('#2f8a5a', dim > .5 ? .65 : .35), 5); }
  }
  return wins;
}
const barrioLayer = dim => layerOf('barrio' + dim, () => { BARRIO_WINDOWS[dim] = barrioBase(dim); });
/* draw the barrio. lit: 0 (everything dark) .. 1 (every window on). night: 0 dusk .. 1 deep night. */
function barrio(lit, night = 1, t = now) {
  const c = barrioLayer(night > .5 ? 1 : 0); blit(c);
  const wins = BARRIO_WINDOWS[night > .5 ? 1 : 0] || [];
  ctx.save(); ctx.translate(SX, 0);
  for (const w of wins) {
    const on = lit > w.th || (w.cand && lit < .06);          // candles stay lit while the grid is off
    const col = w.cand && lit < w.th ? '#ffb347' : w.warm ? '#ffe9a8' : '#cfe6ff';
    if (on) {
      const fl = w.cand && lit < w.th ? .75 + Math.sin(t * 9 + w.x) * .25 : 1;
      ctx.globalAlpha = .28 * fl; ctx.fillStyle = col; ctx.fillRect(w.x - 6, w.y - 6, w.w + 12, w.h + 12);
      ctx.globalAlpha = fl; ctx.fillStyle = col; ctx.fillRect(w.x, w.y, w.w, w.h); ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(80,40,20,.35)'; ctx.fillRect(w.x + w.w / 2 - .7, w.y, 1.4, w.h);
    } else { ctx.fillStyle = night > .5 ? '#0c0a1e' : '#2a1d40'; ctx.fillRect(w.x, w.y, w.w, w.h); }
  }
  ctx.restore();
}

/* ───────────── the sala (living room) ───────────── */
function drawSala() {
  const R = rnd(31);
  ctx.fillStyle = lin(0, 0, 0, 430, [[0, '#92d3c0'], [1, '#78bba7']]); ctx.fillRect(0, 0, SW, 430);
  ctx.fillStyle = 'rgba(255,255,255,.05)'; for (let x = 0; x < SW; x += 64) ctx.fillRect(x, 0, 30, 430);
  for (let i = 0; i < 7; i++) { ctx.fillStyle = `rgba(60,110,100,${.05 + R() * .05})`; ctx.beginPath(); ctx.ellipse(R() * SW, 20 + R() * 60, 60 + R() * 70, 18 + R() * 30, 0, 0, 7); ctx.fill(); }   // humedad
  ctx.fillStyle = '#e8d9bc'; ctx.fillRect(0, 0, SW, 16); ctx.fillStyle = 'rgba(40,20,50,.18)'; ctx.fillRect(0, 16, SW, 10);
  ctx.fillStyle = lin(0, 292, 0, 430, [[0, '#4e9c89'], [1, '#3f8777']]); ctx.fillRect(0, 292, SW, 138);
  ctx.fillStyle = '#d6f2e6'; ctx.fillRect(0, 288, SW, 5); ctx.fillStyle = 'rgba(30,16,50,.22)'; ctx.fillRect(0, 293, SW, 7);
  ctx.fillStyle = '#efe2c6'; ctx.fillRect(0, 406, SW, 24); ctx.fillStyle = 'rgba(30,16,50,.2)'; ctx.fillRect(0, 424, SW, 6);
  /* floor: perspective cerámica tiles */
  const vx = 720, vy = 250, fy = 430;
  ctx.fillStyle = '#d9a566'; ctx.fillRect(0, fy, SW, SHT - fy);
  const rows = 9; let yPrev = fy;
  for (let i = 1; i <= rows; i++) {
    const y = fy + (SHT - fy) * Math.pow(i / rows, 1.55);
    const s0 = 96 * (yPrev - vy) / (fy - vy), s1 = 96 * (y - vy) / (fy - vy);
    for (let j = -16; j < 16; j++) {
      ctx.beginPath(); ctx.moveTo(vx + j * s0, yPrev); ctx.lineTo(vx + (j + 1) * s0, yPrev); ctx.lineTo(vx + (j + 1) * s1, y); ctx.lineTo(vx + j * s1, y); ctx.closePath();
      ctx.fillStyle = (i + j) & 1 ? '#dcab70' : '#cf9a5e'; ctx.fill(); ctx.strokeStyle = 'rgba(90,50,40,.28)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    yPrev = y;
  }
  ctx.fillStyle = lin(0, fy, 0, SHT, [[0, 'rgba(40,20,60,.28)'], [.4, 'rgba(40,20,60,0)'], [1, 'rgba(40,20,60,.2)']]); ctx.fillRect(0, fy, SW, SHT - fy);
  /* window with a reja (iron bars) onto the barrio */
  const wx = 380, wy = 80, ww = 230, wh = 230;
  sh(`M${wx - 14},${wy - 14} L${wx + ww + 14},${wy - 14} L${wx + ww + 14},${wy + wh + 14} L${wx - 14},${wy + wh + 14}Z`, '#f1e6d0', { sh: `M${wx + ww},${wy - 14} L${wx + ww + 14},${wy - 14} L${wx + ww + 14},${wy + wh + 14} L${wx},${wy + wh + 14}Z`, ol: '#7a5a44', lw: 2 });
  ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
  ctx.translate(wx - 180, wy - 170); ctx.scale(.55, .55); ctx.translate(-0, 0);
  ctx.drawImage(barrioLayer(1), 0, 120, 1440, 520, 0, 120, 1440, 520);
  ctx.restore();
  ctx.fillStyle = 'rgba(150,200,255,.07)'; ctx.fillRect(wx, wy, ww, wh);
  stroke(`M${wx + ww / 2},${wy} L${wx + ww / 2},${wy + wh}`, '#f1e6d0', 6);
  for (let x = wx + 14; x < wx + ww; x += 24) stroke(`M${x},${wy} L${x},${wy + wh}`, '#2d2640', 4);
  for (const y of [wy + 70, wy + 150]) stroke(`M${wx},${y} L${wx + ww},${y}`, '#2d2640', 5);
  for (let i = 0; i < 4; i++) { const cx = wx + 40 + i * 50; ctx.strokeStyle = '#2d2640'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, wy + 110, 17, 0, 7); ctx.stroke(); }
  sh(`M${wx - 24},${wy + wh + 14} L${wx + ww + 24},${wy + wh + 14} L${wx + ww + 18},${wy + wh + 26} L${wx - 18},${wy + wh + 26}Z`, '#e6d6b8', { ol: '#7a5a44', lw: 2 });
  /* curtains */
  for (const sd of [-1, 1]) {
    const cx0 = sd < 0 ? wx - 18 : wx + ww + 18;
    ctx.fillStyle = lin(cx0 - 30, 0, cx0 + 30, 0, [[0, '#d8604a'], [.5, '#f08a6a'], [1, '#c2503f']]);
    ctx.beginPath(); ctx.moveTo(cx0 - sd * 6, wy - 22); ctx.lineTo(cx0 + sd * 58, wy - 22); ctx.quadraticCurveTo(cx0 + sd * 38, wy + 120, cx0 + sd * 66, wy + wh + 40); ctx.lineTo(cx0 - sd * 6, wy + wh + 40); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(80,20,40,.25)'; ctx.lineWidth = 2; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx0 + sd * i * 14, wy - 22); ctx.quadraticCurveTo(cx0 + sd * (i * 11 + 4), wy + 120, cx0 + sd * (i * 15), wy + wh + 40); ctx.stroke(); }
  }
  stroke(`M${wx - 40},${wy - 24} L${wx + ww + 40},${wy - 24}`, '#6a4a34', 6);
  /* calendar from the bodega */
  ctx.save(); ctx.translate(305, -26);
  sh('M690,86 L770,86 L770,196 L690,196Z', '#fff8e6', { sh: 'M740,86 L770,86 L770,196 L740,196Z', ol: '#8a6a50', lw: 2 });
  ctx.fillStyle = '#e24a3a'; ctx.fillRect(690, 86, 80, 28); txtc('OCTUBRE', 730, 101, 13, '#fff');
  ctx.fillStyle = '#6a5a60'; for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) ctx.fillRect(697 + c * 14, 124 + r * 15, 9, 7);
  txtc('ABASTO', 730, 185, 9, '#e24a3a'); ctx.restore();
  /* cuadro: Ávila at sunset */
  sh('M830,80 L980,80 L980,180 L830,180Z', '#b5834f', { ol: '#6a4224', lw: 2 });
  ctx.save(); ctx.beginPath(); ctx.rect(840, 90, 130, 80); ctx.clip();
  ctx.fillStyle = lin(0, 90, 0, 170, [[0, '#ffb36b'], [1, '#e8666b']]); ctx.fillRect(840, 90, 130, 80); ell(900, 118, 14, 14, '#fff2c4');
  ctx.fillStyle = '#5a3a78'; ctx.beginPath(); ctx.moveTo(840, 170); ctx.lineTo(870, 128); ctx.lineTo(900, 150); ctx.lineTo(940, 114); ctx.lineTo(970, 170); ctx.fill(); ctx.restore();
  /* mueble with the old TV (rabbit-ear antenna) + crochet doily + a virgen */
  sh('M840,296 L1090,296 L1090,430 L840,430Z', '#8a5a3b', { sh: 'M1040,296 L1090,296 L1090,430 L1040,430Z', hl: 'M840,296 L1090,296 L1090,306 L840,306Z', ol: '#4a2c1c', lw: 2 });
  for (const dx of [850, 970]) { sh(`M${dx},316 L${dx + 110},316 L${dx + 110},420 L${dx},420Z`, '#9a6a47', { ol: '#4a2c1c', lw: 1.8 }); ell(dx + 95, 368, 4, 4, '#e8c26a'); }
  sh('M866,214 Q866,206 876,206 L1054,206 Q1064,206 1064,214 L1064,292 Q1064,298 1056,298 L874,298 Q866,298 866,292Z', '#5a4636', { sh: 'M1030,206 L1064,206 L1064,298 L1030,298Z', hl: 'M866,206 L1064,206 L1064,214 L866,214Z', ol: '#241a14', lw: 2 });
  sh('M878,218 Q878,214 884,214 L1000,214 Q1010,214 1010,224 L1010,284 Q1010,290 1002,290 L886,290 Q878,290 878,284Z', '#0c1216', { hl: 'M878,214 L944,214 Q900,250 878,284Z', hlK: .1, ol: '#000', lw: 2.4 });
  ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(886, 224); ctx.quadraticCurveTo(940, 218, 1000, 224); ctx.stroke();
  ell(1036, 228, 7, 7, '#b9b2a4'); ell(1036, 250, 7, 7, '#b9b2a4'); for (let i = 0; i < 5; i++) stroke(`M1024,${268 + i * 5} L1050,${268 + i * 5}`, '#241a14', 1.6);
  ell(1036, 228, 2, 2, '#241a14'); ell(1036, 250, 2, 2, '#241a14');
  sh('M940,206 L984,206 L976,200 L948,200Z', '#3a2c22', { ol: '#241a14', lw: 1.4 });
  stroke('M960,200 L918,150 M966,200 L1006,146', '#c9ccd6', 3); ell(918, 148, 3.4, 3.4, '#e0e3ee'); ell(1006, 144, 3.4, 3.4, '#e0e3ee');
  /* crochet doily on top of the TV with a virgen + flowers */
  sh('M1050,214 L1086,214 L1086,206 L1050,206Z', '#fffaf0', { ol: '#d8c8a8', lw: 1.4 });
  sh('M1060,206 Q1068,168 1076,206Z', '#cfe3ff', { ol: '#5a7ab0', lw: 1.4 }); ell(1068, 172, 5, 5, '#e8b894');
  sh('M820,300 L848,300 L842,262 L826,262Z', '#e8d9bc', { ol: '#7a5a44', lw: 1.6 });
  for (let i = 0; i < 5; i++) { stroke(`M834,262 L${826 + i * 5},${236 - (i % 2) * 8}`, '#3f8a5a', 2); ell(826 + i * 5, 234 - (i % 2) * 8, 5, 5, ['#ff7a9a', '#ffd04a'][i % 2]); }
  /* left: a door and a lamp; right: a shelf and a matera */
  sh('M40,40 L200,40 L200,420 L40,420Z', '#b9854f', { sh: 'M160,40 L200,40 L200,420 L160,420Z', hl: 'M40,40 L60,40 L60,420 L40,420Z', ol: '#5a3a1e', lw: 2.4 });
  for (const [a, b] of [[58, 70], [58, 250]]) sh(`M${a + 6},${b} L${a + 128},${b} L${a + 128},${b + 150} L${a + 6},${b + 150}Z`, '#a5703f', { ol: '#5a3a1e', lw: 1.8 });
  ell(176, 250, 7, 7, '#e8c26a'); ell(176, 250, 3, 3, '#a8742a');
  sh('M1220,300 L1300,300 L1290,420 L1230,420Z', '#d9663f', { sh: 'M1270,300 L1300,300 L1290,420 L1262,420Z', hl: 'M1220,300 L1236,300 L1238,420 L1230,420Z', ol: '#6a2a1a', lw: 2 });
  for (let i = 0; i < 9; i++) { const a = -3.1 + i * .39; stroke(`M1260,300 Q${1260 + Math.cos(a) * 30},${290 + Math.sin(a) * 40} ${1260 + Math.cos(a) * 66},${270 + Math.sin(a) * 76}`, '#3f9a5a', 8); }
}
/* tiny canvas text for scene art (no outline) */
function txtc(s, x, y, size, col) { ctx.font = `800 ${size}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(s, x, y); }
const salaLayer = () => layerOf('sala', drawSala);
function sala() { blit(salaLayer()); }

/* ───────────── the kitchen ───────────── */
function drawCocina() {
  ctx.fillStyle = lin(0, 0, 0, 430, [[0, '#f3e3b8'], [1, '#e8cf94']]); ctx.fillRect(0, 0, SW, 430);
  /* azulejos */
  for (let y = 200; y < 410; y += 38) for (let x = -10; x < SW; x += 38) {
    const alt = ((x / 38 | 0) + (y / 38 | 0)) & 1;
    sh(`M${x},${y} L${x + 36},${y} L${x + 36},${y + 36} L${x},${y + 36}Z`, alt ? '#f8f4ea' : '#e9efe8', { ol: 'rgba(100,130,130,.35)', lw: 1.4, hl: `M${x},${y} L${x + 36},${y} L${x},${y + 12}Z`, hlK: .6 });
    if (!alt) { ctx.fillStyle = 'rgba(66,150,170,.55)'; ctx.beginPath(); ctx.arc(x + 18, y + 18, 5, 0, 7); ctx.fill(); }
  }
  ctx.fillStyle = 'rgba(40,20,50,.2)'; ctx.fillRect(0, 196, SW, 8);
  /* floor */
  ctx.fillStyle = '#c89a6a'; ctx.fillRect(0, 410, SW, 190);
  for (let x = -40; x < SW + 60; x += 70) for (let y = 410; y < SHT; y += 45) { ctx.fillStyle = ((x / 70 | 0) + (y / 45 | 0)) & 1 ? '#c4936a' : '#d3a577'; ctx.fillRect(x, y, 70, 45); ctx.strokeStyle = 'rgba(70,40,40,.3)'; ctx.strokeRect(x, y, 70, 45); }
  ctx.fillStyle = lin(0, 410, 0, SHT, [[0, 'rgba(40,20,60,.3)'], [.5, 'rgba(40,20,60,0)'], [1, 'rgba(40,20,60,.2)']]); ctx.fillRect(0, 410, SW, 190);
  /* upper cabinets */
  for (const [x, w] of [[300, 150], [452, 150], [830, 160], [992, 150]]) {
    sh(`M${x},40 L${x + w},40 L${x + w},170 L${x},170Z`, '#4aa3a0', { sh: `M${x + w * .8},40 L${x + w},40 L${x + w},170 L${x + w * .8},170Z`, hl: `M${x},40 L${x + 14},40 L${x + 14},170 L${x},170Z`, ol: '#1f5a5c', lw: 2 });
    sh(`M${x + 10},50 L${x + w - 10},50 L${x + w - 10},160 L${x + 10},160Z`, '#58b5b0', { ol: '#1f5a5c', lw: 1.6 }); ell(x + w - 22, 108, 4, 8, '#f2d27a');
  }
  /* window */
  sh('M640,52 L800,52 L800,176 L640,176Z', '#f1e6d0', { ol: '#7a5a44', lw: 2 });
  ctx.fillStyle = lin(0, 60, 0, 170, [[0, '#16113a'], [1, '#5d2f6e']]); ctx.fillRect(650, 62, 140, 104);
  stroke('M720,62 L720,166', '#f1e6d0', 5); for (let x = 664; x < 790; x += 18) stroke(`M${x},62 L${x},166`, '#2d2640', 3);
  /* hanging pots */
  stroke('M1180,60 L1380,60', '#5a3a2a', 4);
  for (const [i, c] of [[0, '#c0c4d0'], [1, '#e8805c'], [2, '#9aa0b4'], [3, '#d9c06a']]) { const px = 1200 + i * 48; stroke(`M${px},60 L${px},${86}`, '#5a3a2a', 2); ell(px, 108, 18, 22, c); ctx.strokeStyle = dark(c, .5); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(px, 108, 18, 22, 0, 0, 7); ctx.stroke(); ell(px - 6, 100, 5, 9, lite(c, .5), -.3, .6); }
  /* counter */
  sh('M0,396 L SW,396 L SW,470 L0,470Z'.replace(/SW/g, SW), '#e8d6b0', { ol: '#7a5a3a', lw: 2 });
  sh('M0,396 L SW,396 L SW,414 L0,414Z'.replace(/SW/g, SW), '#a86a42', { ol: '#5a3a1e', lw: 2, hl: 'M0,396 L1440,396 L1440,402 L0,402Z' });
  ctx.fillStyle = 'rgba(40,20,60,.25)'; ctx.fillRect(0, 414, SW, 12);
}
const cocinaLayer = () => layerOf('cocina', drawCocina);
function cocina() { blit(cocinaLayer()); }

/* ───────────── darkness: cover the scene in night and cut warm light out of it ───────────── */
let _dk;
function darkness(amount, lights, col = '10,8,34') {
  if (amount <= 0 && !lights.length) return;
  if (!_dk) { _dk = document.createElement('canvas'); _dk.width = 480; _dk.height = 200; }
  const d = _dk.getContext('2d'), k = _dk.width / SW;
  d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, _dk.width, _dk.height);
  d.fillStyle = `rgba(${col},${amount})`; d.fillRect(0, 0, _dk.width, _dk.height);
  d.globalCompositeOperation = 'destination-out';
  for (const l of lights) {
    const x = (l.x - SX) * k, y = l.y * (_dk.height / SHT), r = l.r * k, a = l.a == null ? 1 : l.a;
    const g = d.createRadialGradient(x, y, r * .05, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(.55, `rgba(0,0,0,${a * .6})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = g; d.beginPath(); d.arc(x, y, r, 0, 7); d.fill();
  }
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(_dk, SX, 0, SW, SHT); ctx.restore();
  /* warm tint where the lights are */
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const l of lights) { if (!l.glow) continue; const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, l.r); g.addColorStop(0, `rgba(${l.glow},${l.ga == null ? .35 : l.ga})`); g.addColorStop(1, `rgba(${l.glow},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, 7); ctx.fill(); }
  ctx.restore();
}

/* ───────────── props ───────────── */
/* hanging bulb: cable from the ceiling, glass + filament; L = 0 (dead) .. 1 (full light). Glow comes from darkness() lights. */
function bulb(x, y, L) {
  stroke(`M${x},-10 L${x},${y - 18}`, '#2a2233', 3);
  sh(`M${x - 8},${y - 20} L${x + 8},${y - 20} L${x + 7},${y - 8} L${x - 7},${y - 8}Z`, '#7a7280', { sh: `M${x + 2},${y - 20} L${x + 8},${y - 20} L${x + 7},${y - 8} L${x + 2},${y - 8}Z`, ol: '#2a2233', lw: 1.6 });
  const g = L > .02 ? '#fff4b8' : '#c9d6e0';
  if (L > .02) { ctx.fillStyle = rad(x, y + 6, 4, 90 * L + 20, [[0, `rgba(255,236,150,${.7 * L})`], [1, 'rgba(255,236,150,0)']]); ctx.beginPath(); ctx.arc(x, y + 6, 90 * L + 20, 0, 7); ctx.fill(); }
  ctx.globalAlpha = L > .02 ? 1 : .55; ctx.fillStyle = L > .02 ? mix('#cfe0ea', g, L) : g;
  ctx.beginPath(); ctx.moveTo(x - 6, y - 8); ctx.bezierCurveTo(x - 20, y, x - 14, y + 22, x, y + 22); ctx.bezierCurveTo(x + 14, y + 22, x + 20, y, x + 6, y - 8); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(60,50,80,.6)'; ctx.lineWidth = 1.6; ctx.stroke();
  stroke(`M${x - 3},${y - 6} L${x - 2},${y + 6} L${x + 2},${y + 6} L${x + 3},${y - 6}`, L > .02 ? '#ff9a2e' : '#6a6270', 1.6);
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(x - 7, y + 3, 2.4, 6, .2, 0, 7); ctx.fill();
}
/* a candle held in a hand (drawn in hand space, flame flickers) */
function candle() {
  sh('M-6,0 L6,0 L6,-34 L-6,-34Z', '#f4ecd8', { sh: 'M2,0 L6,0 L6,-34 L2,-34Z', hl: 'M-6,0 L-3,0 L-3,-34 L-6,-34Z', ol: '#a8987a', lw: 1.4 });
  ell(0, -34, 6, 2.4, '#e8dcc0'); ell(2, -30, 2.5, 6, '#fffaf0', 0, .7);
  stroke('M0,-35 L0,-39', '#3a2a2a', 1.6);
  const f = 1 + Math.sin(now * 17) * .12 + Math.sin(now * 29) * .06;
  ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.moveTo(0, -37); ctx.bezierCurveTo(-9, -46, -3 * f, -56 * f, 0, -64 * f); ctx.bezierCurveTo(3 * f, -56 * f, 9, -46, 0, -37); ctx.fill();
  ctx.fillStyle = '#ffe36a'; ctx.beginPath(); ctx.moveTo(0, -38); ctx.bezierCurveTo(-5, -44, -2, -50 * f, 0, -55 * f); ctx.bezierCurveTo(2, -50 * f, 5, -44, 0, -38); ctx.fill();
}
/* chancleta (flip-flop): the national weapon. Drawn pointing up from the hand. */
function chancleta(col = '#e8445a') {
  sh('M-11,6 Q-17,-26 -10,-52 Q0,-64 10,-52 Q17,-26 11,6 Q0,12 -11,6Z', col, { sh: 'M3,6 Q14,-24 8,-52 Q16,-40 11,6Z', hl: 'M-11,6 Q-17,-26 -10,-52 L-5,-54 Q-9,-26 -5,5Z', ol: dark(col, .5), lw: 2 });
  sh('M-11,6 Q0,12 11,6 L11,11 Q0,18 -11,11Z', '#f5efe2', { ol: '#9a8f78', lw: 1.6 });
  stroke('M-8,-4 L0,-22 L8,-4', '#f5efe2', 5); ell(0, -22, 3.4, 3.4, '#f5efe2');
}
function spatula() {
  stroke('M0,8 L0,-30', '#7a4a2a', 6); sh('M-14,-30 L14,-30 L12,-62 L-12,-62Z', '#cdd3de', { sh: 'M4,-30 L14,-30 L12,-62 L4,-62Z', hl: 'M-14,-30 L-8,-30 L-8,-62 L-12,-62Z', ol: '#59627a', lw: 1.8 });
  for (const x of [-6, 0, 6]) stroke(`M${x},-38 L${x},-56`, '#59627a', 1.4);
}
function phone(pct, w = 78, h = 142) {
  sh(`M${-w / 2},${-h / 2} L${w / 2},${-h / 2} L${w / 2},${h / 2} L${-w / 2},${h / 2}Z`, '#1d1b27', { ol: '#0a0910', lw: 2.4, hl: `M${-w / 2},${-h / 2} L${-w / 2 + 6},${-h / 2} L${-w / 2 + 6},${h / 2} L${-w / 2},${h / 2}Z`, hlK: .15 });
  const danger = pct <= 5, bl = danger && Math.sin(now * 9) > 0;
  ctx.fillStyle = danger ? '#2a0f1a' : '#10202a'; ctx.fillRect(-w / 2 + 6, -h / 2 + 12, w - 12, h - 24);
  ctx.fillStyle = bl ? '#ff4d4d' : danger ? '#ff8a8a' : '#6aff9a'; ctx.font = '900 24px Arial Black, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(pct + '%', 0, -h / 2 + 38);
  sh(`M-18,-6 L14,-6 L14,16 L-18,16Z`, 'rgba(0,0,0,0)', { ol: bl ? '#ff4d4d' : '#ddd', lw: 2.4 }); ctx.fillStyle = bl ? '#ff4d4d' : '#ddd'; ctx.fillRect(15, 1, 4, 9);
  ctx.fillStyle = bl ? '#ff4d4d' : '#ff8a8a'; ctx.fillRect(-16, -4, Math.max(2, 28 * Math.min(1, pct / 100) * 3), 18);
  stroke(`M-${w / 2 - 6},${h / 2 - 20} L${w / 2 - 6},${h / 2 - 20}`, 'rgba(255,255,255,.15)', 1);
}
/* wall switch plate: on = toggle up */
function wallSwitch(x, y, on, s = 1) {
  at(x, y, 0, s, s, () => {
    sh('M-24,-38 L24,-38 L24,38 L-24,38Z', '#f1ead8', { sh: 'M12,-38 L24,-38 L24,38 L12,38Z', hl: 'M-24,-38 L24,-38 L24,-32 L-24,-32Z', ol: '#8a7a5a', lw: 2.2 });
    ell(0, -28, 2.4, 2.4, '#a89a7a'); ell(0, 28, 2.4, 2.4, '#a89a7a');
    sh('M-11,-17 L11,-17 L11,17 L-11,17Z', '#2a2a36', { ol: '#0a0910', lw: 1.6 });
    at(0, 0, 0, 1, 1, () => { const ty = on ? -8 : 8; sh(`M-8,${ty - 9} L8,${ty - 9} L8,${ty + 9} L-8,${ty + 9}Z`, '#fffaf0', { sh: `M2,${ty - 9} L8,${ty - 9} L8,${ty + 9} L2,${ty + 9}Z`, ol: '#7a6a4a', lw: 1.6 }); });
  });
}
/* a pole-mounted... no: a wall outlet with its two slots, and a plug */
function outlet(x, y, s = 1, lit = false) {
  at(x, y, 0, s, s, () => {
    sh('M-34,-34 L34,-34 L34,34 L-34,34Z', '#f4efe2', { sh: 'M18,-34 L34,-34 L34,34 L18,34Z', hl: 'M-34,-34 L34,-34 L34,-26 L-34,-26Z', ol: '#8a7a5a', lw: 2.4 });
    for (const dx of [-12, 12]) { sh(`M${dx - 3},-12 L${dx + 3},-12 L${dx + 3},12 L${dx - 3},12Z`, '#1a1722', { ol: '#000', lw: 1 }); }
    ell(0, 0, 5, 5, '#2a2633'); ell(0, 24, 3, 3, '#a89a7a'); ell(0, -24, 3, 3, '#a89a7a');
    if (lit) { ctx.globalAlpha = .6 + Math.sin(now * 20) * .3; stroke('M-26,-26 L-14,-14 M26,-26 L14,-14 M0,-40 L0,-30', '#7ae8ff', 3); ctx.globalAlpha = 1; }
  });
}
function plug(x, y, s = 1, rot = 0) {
  at(x, y, rot, s, s, () => {
    sh('M-22,-16 L22,-16 L22,26 L-22,26Z', '#2f6fd8', { sh: 'M10,-16 L22,-16 L22,26 L10,26Z', hl: 'M-22,-16 L-14,-16 L-14,26 L-22,26Z', ol: '#12306a', lw: 2.2 });
    for (const dx of [-12, 12]) sh(`M${dx - 3},-34 L${dx + 3},-34 L${dx + 3},-16 L${dx - 3},-16Z`, '#d9dde8', { ol: '#59627a', lw: 1.4 });
    stroke('M0,26 Q0,40 0,52', '#14161f', 7);
  });
}
/* the zancudo: a mosquito. size u. wings blur, long legs, a needle nose. */
function zancudo(x, y, u, ang, t) {
  at(x, y, ang, u, u, () => {
    const fl = Math.sin(t * 90) * .5;
    for (const sd of [-1, 1]) { ctx.save(); ctx.rotate(sd * (.9 + fl * .5)); ctx.fillStyle = 'rgba(210,235,255,.5)'; ctx.beginPath(); ctx.ellipse(sd * 4, -22, 8, 22, sd * .2, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore(); }
    for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) { stroke(`M${sd * 4},${-2 + i * 6} Q${sd * 18},${i * 8 + 4 + Math.sin(t * 30 + i) * 3} ${sd * 24},${i * 10 + 18}`, '#2a1f33', 1.8); }
    sh('M0,-14 C9,-12 10,10 3,26 L0,32 L-3,26 C-10,10 -9,-12 0,-14Z', '#4a3a55', { sh: 'M0,-14 C9,-12 10,10 3,26 L0,32 L0,0Z', hl: 'M-6,-8 Q-8,6 -4,18', ol: '#1a1224', lw: 1.6 });
    for (let i = 0; i < 4; i++) stroke(`M-7,${-4 + i * 7} L7,${-4 + i * 7}`, '#d9d0e0', 1.4);
    ell(0, -18, 6, 6, '#2e2238'); ell(-2.4, -19, 1.6, 1.6, '#ff4d4d'); ell(2.4, -19, 1.6, 1.6, '#ff4d4d');
    stroke('M0,-22 L0,-40', '#1a1224', 2.2);
  });
}
/* the fridge. open 0 (shut) .. 1 (wide open). Draws the body, the glowing inside, the door swinging. */
function fridge(x, y, open, sweat = 0) {
  const w = 190, h = 360, x0 = x - w / 2, y0 = y - h;
  sh(`M${x0},${y0} L${x0 + w},${y0} L${x0 + w},${y} L${x0},${y}Z`, '#eaf0ee', { sh: `M${x0 + w * .78},${y0} L${x0 + w},${y0} L${x0 + w},${y} L${x0 + w * .78},${y}Z`, hl: `M${x0},${y0} L${x0 + 12},${y0} L${x0 + 12},${y} L${x0},${y}Z`, ol: '#7a8a8a', lw: 2.6 });
  /* the inside */
  if (open > .02) {
    ctx.save(); ctx.beginPath(); ctx.rect(x0 + 10, y0 + 10, w - 20, h - 20); ctx.clip();
    ctx.fillStyle = lin(0, y0, 0, y, [[0, '#f4fdff'], [1, '#cfeaf0']]); ctx.fillRect(x0, y0, w, h);
    for (const sy of [y0 + 110, y0 + 200, y0 + 290]) { ctx.fillStyle = 'rgba(160,210,220,.6)'; ctx.fillRect(x0 + 10, sy, w - 20, 5); }
    /* pollo, huevos, juice, queso */
    ell(x - 28, y0 + 88, 26, 18, '#f2c48a'); ell(x - 28, y0 + 82, 24, 12, '#f8d9a8'); stroke(`M${x - 50},${y0 + 90} Q${x - 56},${y0 + 98} ${x - 46},${y0 + 100}`, '#d9a066', 5);
    for (let i = 0; i < 6; i++) ell(x + 22 + (i % 3) * 14, y0 + 190 + Math.floor(i / 3) * 9 - 0, 7, 9, '#fbe7c4');
    sh(`M${x - 54},${y0 + 150} L${x - 30},${y0 + 150} L${x - 30},${y0 + 198} L${x - 54},${y0 + 198}Z`, '#ff9a3c', { ol: '#a8501a', lw: 1.6 });
    sh(`M${x + 26},${y0 + 262} L${x + 58},${y0 + 262} L${x + 50},${y0 + 288} L${x + 26},${y0 + 288}Z`, '#ffd04a', { ol: '#a8801a', lw: 1.6 });
    ctx.fillStyle = 'rgba(190,240,255,.28)'; ctx.fillRect(x0, y0, w, h);
    ctx.restore();
  }
  /* the door: hinged on the right; as it opens the visible face shrinks and is skewed for perspective */
  const th = open * 1.05, dw = w * Math.cos(th), skew = Math.sin(th) * 22;
  const xr = x0 + w, xl = xr - dw;
  const door = `M${xr},${y0} L${xl},${y0 - skew} L${xl},${y + skew * .2} L${xr},${y}Z`;
  sh(door, '#f6faf8', { sh: `M${xr},${y0} L${xr - dw * .35},${y0 - skew * .35} L${xr - dw * .35},${y + skew * .08} L${xr},${y}Z`, hl: `M${xl},${y0 - skew} L${xl + dw * .1},${y0 - skew * .9} L${xl + dw * .1},${y + skew * .18} L${xl},${y + skew * .2}Z`, ol: '#7a8a8a', lw: 2.4 });
  if (open < .7) { /* freezer split + handle on the door face */
    const fy = y0 + (y - y0) * .3;
    ctx.save(); ctx.beginPath(); ctx.moveTo(xr, y0); ctx.lineTo(xl, y0 - skew); ctx.lineTo(xl, y + skew * .2); ctx.lineTo(xr, y); ctx.closePath(); ctx.clip();
    ctx.fillStyle = 'rgba(80,100,110,.5)'; ctx.fillRect(xl, fy - 2 - skew * .3, dw, 4);
    sh(`M${xl + 14 * Math.cos(th)},${fy + 14} L${xl + 22 * Math.cos(th)},${fy + 14} L${xl + 22 * Math.cos(th)},${fy + 74} L${xl + 14 * Math.cos(th)},${fy + 74}Z`, '#b9c2c8', { ol: '#59627a', lw: 1.4 });
    sh(`M${xl + 14 * Math.cos(th)},${fy - 56} L${xl + 22 * Math.cos(th)},${fy - 56} L${xl + 22 * Math.cos(th)},${fy - 12} L${xl + 14 * Math.cos(th)},${fy - 12}Z`, '#b9c2c8', { ol: '#59627a', lw: 1.4 });
    /* magnets: a Venezuelan staple */
    ell(xr - dw * .55, y0 + 150, 12, 12, '#e8433a'); ell(xr - dw * .35, y0 + 190, 10, 10, '#4bb8b0'); ell(xr - dw * .72, y0 + 214, 9, 9, '#ffd04a');
    ctx.restore();
  }
  /* feet + sweat drops on the door: the fridge is thawing */
  sh(`M${x0 + 6},${y} L${x0 + 26},${y} L${x0 + 22},${y + 8} L${x0 + 10},${y + 8}Z`, '#59627a', { ol: '#2b3040', lw: 1.2 }); sh(`M${x0 + w - 26},${y} L${x0 + w - 6},${y} L${x0 + w - 10},${y + 8} L${x0 + w - 22},${y + 8}Z`, '#59627a', { ol: '#2b3040', lw: 1.2 });
}
/* an arepa on the budare. cook 0..1 (pale -> golden at ~.65 -> burnt). flip 0..1 animates the toss. */
function arepaCol(c) {
  return c < .5 ? mix('#f6e7b8', '#ecc66a', c / .5) : c < .72 ? mix('#ecc66a', '#d98a2a', (c - .5) / .22) : mix('#d98a2a', '#4a2412', clamp((c - .72) / .28, 0, 1));
}
function arepa(x, y, cook, flip = 0, s = 1) {
  const col = arepaCol(cook);
  at(x, y - Math.sin(flip * Math.PI) * 120 * s, flip * 6.28, s, s * (1 - .08), () => {
    ctx.save(); ctx.scale(1, .42);
    sh('M-62,0 A62,62 0 1 0 62,0 A62,62 0 1 0 -62,0Z', mix(col, '#7a4a1a', .25), { ol: dark(col, .5), lw: 2.4 });
    ctx.translate(0, -10);
    sh('M-62,0 A62,62 0 1 0 62,0 A62,62 0 1 0 -62,0Z', col, { sh: 'M20,-62 A62,62 0 0 1 20,62 A62,62 0 0 0 62,0 A62,62 0 0 0 20,-62Z', hl: 'M-62,0 A62,62 0 0 1 -20,-58 A50,50 0 0 0 -50,10Z', ol: dark(col, .5), lw: 2.4 });
    ctx.restore();
    /* toasted spots */
    ctx.fillStyle = dark(col, .35); for (let i = 0; i < 9; i++) { ctx.globalAlpha = .25 + cook * .35; ctx.beginPath(); ctx.ellipse(Math.cos(i * 2.4) * (14 + i * 4), -4 + Math.sin(i * 2.4) * 9, 6 + (i % 3) * 2, 3, 0, 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
  });
}
function budare(x, y, w = 250) {
  /* stove top with a flame ring, then the clay griddle */
  sh(`M${x - w * .62},${y + 18} L${x + w * .62},${y + 18} L${x + w * .66},${y + 78} L${x - w * .66},${y + 78}Z`, '#3a3a48', { sh: `M${x + w * .3},${y + 18} L${x + w * .62},${y + 18} L${x + w * .66},${y + 78} L${x + w * .3},${y + 78}Z`, hl: `M${x - w * .62},${y + 18} L${x + w * .62},${y + 18} L${x + w * .63},${y + 26} L${x - w * .63},${y + 26}Z`, ol: '#14141c', lw: 2.4 });
  sh(`M${x - w / 2},${y} Q${x},${y + 38} ${x + w / 2},${y} L${x + w / 2},${y - 12} Q${x},${y + 24} ${x - w / 2},${y - 12}Z`, '#2c2630', { ol: '#0a0910', lw: 2 });
  ctx.fillStyle = lin(0, y - 40, 0, y + 6, [[0, '#4a4452'], [1, '#2c2630']]);
  ctx.beginPath(); ctx.ellipse(x, y - 8, w / 2, 24, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#0a0910'; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.ellipse(x - w * .16, y - 14, w * .28, 8, -.08, 0, 7); ctx.fill();
}
function flame(x, y, w, k, t) {
  /* gas flame that sputters: k = strength 0..1 */
  for (let i = 0; i < 9; i++) {
    const fx = x - w / 2 + (i + .5) * w / 9, fh = (10 + 22 * k) * (.7 + .3 * Math.sin(t * 14 + i * 1.7)) * (i % 2 ? .85 : 1);
    ctx.fillStyle = '#3b7bff'; ctx.beginPath(); ctx.moveTo(fx - 5, y); ctx.quadraticCurveTo(fx, y - fh * 1.3, fx + 5, y); ctx.fill();
    ctx.fillStyle = '#9ad4ff'; ctx.beginPath(); ctx.moveTo(fx - 3, y); ctx.quadraticCurveTo(fx, y - fh * .8, fx + 3, y); ctx.fill();
  }
}
/* speech bubble with a tail pointing at (tx, ty); text drawn with the game's chunky font */
function bubble(s, x, y, tx, ty, size = 26, scale = 1, col = '#fff') {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
  const w = ctx.measureText(t(s)).width + 34, h = size + 24;
  const ax = clamp(tx - x, -w / 2 + 16, w / 2 - 16), ay = ty - y;
  ctx.fillStyle = 'rgba(30,18,50,.28)'; ctx.beginPath(); ctx.roundRect(-w / 2 + 4, -h / 2 + 5, w, h, 16); ctx.fill();
  ctx.fillStyle = col; ctx.strokeStyle = '#2a1740'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 16); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ax - 10, h / 2 - 2); ctx.lineTo(ax * 1.15, ay * .55 > h / 2 + 8 ? ay * .55 : h / 2 + 18); ctx.lineTo(ax + 12, h / 2 - 2); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ax - 8, h / 2 - 3); ctx.lineTo(ax + 10, h / 2 - 3); ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.stroke();
  ctx.fillStyle = '#2a1740'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t(s), 0, 2);
  ctx.restore();
}

/* ───────────── boss art: the transformer on the pole, with a face ───────────── */
/* mood: 'angry' | 'zap' (about to blow, red eyes, arcs) | 'dizzy' (beaten: spiral eyes, tongue, smoke). Origin = bottom centre of the tank. */
function transformer(x, y, s, mood, t, hurt = 0) {
  at(x, y, mood === 'dizzy' ? Math.sin(t * 3) * .05 : Math.sin(t * 20) * (mood === 'zap' ? .012 : 0), s, s, () => {
    /* cables dangling like arms */
    for (const sd of [-1, 1]) {
      ctx.strokeStyle = '#14101f'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sd * 92, -120); ctx.bezierCurveTo(sd * 150, -110, sd * 150 + Math.sin(t * 2 + sd) * 14, -40, sd * 120, 10 + Math.sin(t * 3) * 6); ctx.stroke();
      ctx.strokeStyle = '#3a3552'; ctx.lineWidth = 3; ctx.stroke();
      sh(`M${sd * 120 - 9},8 L${sd * 120 + 9},8 L${sd * 120 + 7},30 L${sd * 120 - 7},30Z`, '#d9dde8', { ol: '#59627a', lw: 1.6 });     // bare clamp "hands"
    }
    /* insulators (bushings) */
    for (const bx of [-52, 0, 52]) {
      stroke(`M${bx},-228 L${bx},-262`, '#14101f', 5);
      for (let i = 0; i < 4; i++) sh(`M${bx - 14 + i * 1},${-224 - i * 11} Q${bx},${-231 - i * 11} ${bx + 14 - i},${-224 - i * 11} L${bx + 12 - i},${-217 - i * 11} Q${bx},${-213 - i * 11} ${bx - 12 + i},${-217 - i * 11}Z`, '#d9a86a', { sh: `M${bx + 4},${-224 - i * 11} L${bx + 14 - i},${-224 - i * 11} L${bx + 12 - i},${-217 - i * 11} L${bx + 4},${-217 - i * 11}Z`, ol: '#6a4524', lw: 1.5 });
      ell(bx, -272, 6, 5, '#b9c2c8');
    }
    /* the tank */
    const body = 'M-98,-26 L-98,-206 Q-98,-232 -72,-232 L72,-232 Q98,-232 98,-206 L98,-26 Q98,-6 76,-6 L-76,-6 Q-98,-6 -98,-26Z';
    sh(body, '#7e8ca3', { sh: 'M44,-232 L98,-232 L98,-6 L44,-6Z', hl: 'M-98,-232 L-80,-232 L-80,-6 L-98,-6Z', hlK: .3, ol: '#262a3a', lw: 3.2 });
    ctx.save(); ctx.clip(P2(body));
    for (let i = 0; i < 9; i++) { ctx.fillStyle = 'rgba(30,24,60,.16)'; ctx.fillRect(-100, -222 + i * 24, 200, 4); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(-100, -218 + i * 24, 200, 2); }
    ctx.fillStyle = 'rgba(40,25,10,.25)'; for (const [rx, ry, rr] of [[-70, -40, 12], [66, -60, 9], [-30, -20, 7]]) ell(rx, ry, rr, rr * .6, 'rgba(120,70,30,.5)');   // rust
    ctx.restore();
    sh('M-98,-232 L98,-232 L98,-214 L-98,-214Z', '#5d6a82', { ol: '#262a3a', lw: 2.4 });
    /* warning label with a bolt on the belly */
    sh('M-34,-58 L34,-58 L34,-22 L-34,-22Z', '#ffd23f', { ol: '#262a3a', lw: 2.4 });
    sh('M4,-54 L-12,-36 L-2,-36 L-8,-24 L12,-44 L2,-44Z', '#262a3a', { ol: 0 });
    /* the face */
    const zap = mood === 'zap', diz = mood === 'dizzy';
    for (const sd of [-1, 1]) {
      const ex = sd * 40, ey = -152;
      ell(ex, ey, 26, 26, '#fffaf0'); ctx.strokeStyle = '#262a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ex, ey, 26, 0, 7); ctx.stroke();
      if (diz) { ctx.strokeStyle = '#262a3a'; ctx.lineWidth = 3; ctx.beginPath(); for (let a = 0; a < 18; a += .3) { const r = 2 + a * 1.2; ctx.lineTo(ex + Math.cos(a + t * 6 * sd) * r, ey + Math.sin(a + t * 6 * sd) * r); } ctx.stroke(); }
      else {
        const gx = Math.sin(t * 1.3) * 4;
        ell(ex + gx, ey + 3, 13, 13, zap ? '#ff3b3b' : '#e8a020'); ell(ex + gx, ey + 3, 6.5, 6.5, '#14101f'); ell(ex + gx - 4, ey - 2, 4, 4, '#fff');
        if (zap) { ctx.fillStyle = rad(ex, ey, 4, 44, [[0, 'rgba(255,60,60,.6)'], [1, 'rgba(255,60,60,0)']]); ctx.beginPath(); ctx.arc(ex, ey, 44, 0, 7); ctx.fill(); }
        ctx.strokeStyle = '#14101f'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ex + sd * 32, ey - 44); ctx.lineTo(ex - sd * 24, ey - 22 + (zap ? 8 : 0)); ctx.stroke();   // brow, slanted down to the middle
      }
    }
    /* mouth: a jagged grin */
    const mo = diz ? 'M-44,-98 Q0,-84 44,-98 Q36,-72 0,-70 Q-36,-72 -44,-98Z' : zap ? 'M-52,-110 L-40,-90 L-28,-112 L-14,-88 L0,-112 L14,-88 L28,-112 L40,-90 L52,-110 Q44,-60 0,-58 Q-44,-60 -52,-110Z' : 'M-46,-104 Q0,-92 46,-104 Q40,-72 0,-70 Q-40,-72 -46,-104Z';
    ctx.fillStyle = '#2a0a14'; ctx.fill(P2(mo)); ctx.save(); ctx.clip(P2(mo));
    ctx.fillStyle = '#fffaf0'; for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * 11 - 6, -112); ctx.lineTo(i * 11 + 6, -112); ctx.lineTo(i * 11, -96 + (i % 2) * 4); ctx.fill(); }
    ctx.fillStyle = '#e8566e'; ctx.beginPath(); ctx.ellipse(diz ? 18 : 0, -64 - (diz ? 6 : 0), 22, diz ? 22 : 12, 0, 0, 7); ctx.fill(); ctx.restore();
    stroke(mo, '#14101f', 3.2);
    /* sparks: a ring of little arcs when it is angry, big ones when it is about to blow */
    if (!diz) {
      const n = zap ? 7 : 3;
      for (let i = 0; i < n; i++) {
        const a = t * 6 + i * 6.28 / n, r0 = 100 + Math.sin(t * 9 + i) * 8, r1 = r0 + (zap ? 70 : 34) * (.6 + .4 * Math.sin(t * 17 + i * 2));
        const x0 = Math.cos(a) * r0 * 1.0, y0 = -130 + Math.sin(a) * r0 * 1.1, x1 = Math.cos(a + .15) * r1, y1 = -130 + Math.sin(a + .15) * r1 * 1.1;
        ctx.strokeStyle = zap ? '#fff' : '#9fe8ff'; ctx.lineWidth = zap ? 4 : 3; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo((x0 + x1) / 2 + Math.sin(t * 50 + i) * 12, (y0 + y1) / 2 + Math.cos(t * 50 + i) * 12); ctx.lineTo(x1, y1); ctx.stroke();
      }
    } else {
      for (let i = 0; i < 5; i++) { const u = (t * .5 + i / 5) % 1; ctx.globalAlpha = (1 - u) * .55; ell(-30 + i * 14 + Math.sin(t * 3 + i) * 10, -240 - u * 120, 14 + u * 22, 10 + u * 14, '#3a3748'); ctx.globalAlpha = 1; }
    }
    if (hurt > 0) { ctx.globalAlpha = hurt * .5; ctx.fillStyle = '#fff'; ctx.fill(P2(body)); ctx.globalAlpha = 1; }
  });
}
/* the big knife-switch breaker bolted to the pole. k: 0 = lever down (power off) .. 1 = lever up (power on). Returns the handle position. */
function breaker(x, y, k, glow = 0) {
  sh(`M${x - 62},${y - 120} L${x + 62},${y - 120} L${x + 62},${y + 60} L${x - 62},${y + 60}Z`, '#4a5266', { sh: `M${x + 30},${y - 120} L${x + 62},${y - 120} L${x + 62},${y + 60} L${x + 30},${y + 60}Z`, hl: `M${x - 62},${y - 120} L${x + 62},${y - 120} L${x + 62},${y - 108} L${x - 62},${y - 108}Z`, ol: '#1a1d2a', lw: 3 });
  for (const [bx, by] of [[x - 50, y - 108], [x + 50, y - 108], [x - 50, y + 48], [x + 50, y + 48]]) { ell(bx, by, 5, 5, '#b9c2c8'); ell(bx - 1, by - 1, 1.6, 1.6, '#fff'); }
  /* contact jaws up top */
  sh(`M${x - 18},${y - 100} L${x - 8},${y - 100} L${x - 8},${y - 70} L${x - 18},${y - 70}Z`, '#d98a3a', { ol: '#5a3210', lw: 1.6 }); sh(`M${x + 8},${y - 100} L${x + 18},${y - 100} L${x + 18},${y - 70} L${x + 8},${y - 70}Z`, '#d98a3a', { ol: '#5a3210', lw: 1.6 });
  /* the lever swings from 'down-left' to 'straight up' around a pivot near the bottom */
  const px = x, py = y + 24, ang = lerp(-1.25, 0, k), len = 118;
  const hx = px + Math.sin(ang) * len, hy = py - Math.cos(ang) * len;
  ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
  sh('M-7,0 L7,0 L6,-110 L-6,-110Z', '#cfd5e0', { sh: 'M2,0 L7,0 L6,-110 L2,-110Z', hl: 'M-7,0 L-3,0 L-3,-110 L-6,-110Z', ol: '#59627a', lw: 1.8 });
  sh('M-11,-96 L11,-96 L10,-136 L-10,-136Z', '#e8433a', { sh: 'M2,-96 L11,-96 L10,-136 L2,-136Z', hl: 'M-11,-96 L-6,-96 L-6,-136 L-10,-136Z', ol: '#6a1a14', lw: 2 });
  ctx.restore();
  ell(px, py, 12, 12, '#59627a'); ell(px, py, 5, 5, '#d9dde8');
  if (glow > 0) { ctx.fillStyle = rad(hx, hy, 4, 60, [[0, `rgba(255,236,150,${glow * .7})`], [1, 'rgba(255,236,150,0)']]); ctx.beginPath(); ctx.arc(hx, hy, 60, 0, 7); ctx.fill(); }
  return { x: hx, y: hy - 14 };
}

return { transformer, breaker, bulb, candle, chancleta, spatula, phone, wallSwitch, outlet, plug, zancudo, fridge, arepa, arepaCol, budare, flame, bubble, SX, SW, SHT, blit, offscreen, layerOf, sala, cocina, barrio, darkness, txtc, P2, sh, stroke, ell, lin, rad, at, mix, dark, lite, clamp, lerp, ease, rgb, hex, memoK, CAST, POSE, person, head, talkAmt };
})(ctx);
