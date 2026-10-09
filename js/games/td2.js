'use strict';
/* 3D stage, set 2: td_tunnel (FLY!), td_mole (WHACK!), td_roll (ROLL!), td_basket (CATCH!). Wrapped in an IIFE so helpers don't leak into the shared global scope.
   Art: the DUO look in 3D (docs/ART-STYLE.md): toon (cel) materials with inked hulls, a 2D painted place under the transparent WebGL layer, a 3D Caos with a
   face that reacts, 2D payoffs on top. ART ONLY: every Math.random call of the game (rnd / Math.random) keeps its count and order; all decor uses the
   local hash / mulberry32 generators. */
(() => {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dispose = o => o.traverse(m => { if (m.geometry && !m.geometry._keep) m.geometry.dispose(); });
  const ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  const outBack = k => { k = clamp(k, 0, 1) - 1; const c = 1.70158; return 1 + (c + 1) * k * k * k + c * k * k; };
  const hash = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  /* ───────────── 2D kit (cosmetic only). Q is the context we draw on: ctx, or an offscreen canvas while baking ───────────── */
  let Q = null;
  const bake = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const p = Q; Q = c.getContext('2d'); try { fn(); } finally { Q = p; } return c; };
  const rr = (x, y, w, h, r) => { Q.beginPath(); Q.moveTo(x + r, y); Q.arcTo(x + w, y, x + w, y + h, r); Q.arcTo(x + w, y + h, x, y + h, r); Q.arcTo(x, y + h, x, y, r); Q.arcTo(x, y, x + w, y, r); Q.closePath(); };
  const el = (x, y, rx, ry, rot = 0) => { Q.beginPath(); Q.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, TAU); };
  const ink = (fill, o = 4, col = INK) => { Q.lineJoin = 'round'; Q.lineCap = 'round'; if (o) { Q.lineWidth = o * 2; Q.strokeStyle = col; Q.stroke(); } if (fill) { Q.fillStyle = fill; Q.fill(); } };
  const glint = (x, y, rx, ry, a = .45, rot = -.5) => { Q.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); Q.fill(); };
  const star5 = (x, y, ro, ri, n, rot, fill, o = 3) => { Q.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = rot + i * Math.PI / n; Q.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } Q.closePath(); ink(fill, o); };
  const heart = (x, y, s, a = 1) => {
    Q.save(); Q.globalAlpha = a; Q.translate(x, y); Q.scale(s, s); Q.beginPath(); Q.moveTo(0, 8); Q.bezierCurveTo(-18, -4, -12, -20, 0, -10); Q.bezierCurveTo(12, -20, 18, -4, 0, 8); Q.closePath();
    ink('#ff5c8a', 3); glint(-6, -9, 3, 2, .6, -.6); Q.restore();
  };
  const sweat = (x, y, s, T) => { const k = (T * 2.2) % 1; Q.save(); Q.globalAlpha = 1 - k; Q.translate(x + k * 6, y + k * 14); Q.scale(s, s); Q.beginPath(); Q.moveTo(0, -8); Q.quadraticCurveTo(6, 0, 0, 5); Q.quadraticCurveTo(-6, 0, 0, -8); ink('#9fe3ff', 2); Q.restore(); };
  const cloud = (x, y, s) => {
    Q.save(); Q.translate(x, y); Q.scale(s, s); const c = [[0, 0, 22], [24, -10, 26], [50, 0, 20], [24, 6, 22]];
    for (const [a, b, r] of c) { Q.beginPath(); Q.arc(a, b, r, 0, TAU); ink(null, 3); }
    for (const [a, b, r] of c) { Q.beginPath(); Q.arc(a, b, r, 0, TAU); Q.fillStyle = '#e4f5ff'; Q.fill(); }
    for (const [a, b, r] of c) { Q.beginPath(); Q.arc(a - 3, b - 5, r * .8, 0, TAU); Q.fillStyle = '#fff'; Q.fill(); } Q.restore();
  };
  const sunDisc = (sx, sy, T) => {
    Q.save(); Q.translate(sx, sy); Q.rotate(T * .25); Q.fillStyle = 'rgba(255,240,150,.45)';
    for (let i = 0; i < 10; i++) { Q.rotate(TAU / 10); Q.beginPath(); Q.moveTo(-8, 40); Q.lineTo(8, 40); Q.lineTo(0, 70); Q.fill(); }
    Q.restore(); Q.beginPath(); Q.arc(sx, sy, 32, 0, TAU); ink('#ffe14d', 4); glint(sx - 10, sy - 10, 12, 8, .6, -.6);
  };
  /* wordless "that's you" tag: a gold pill with a star and a pointer */
  const tag = (x, y, a = 1, col = '#FFE14D') => {
    Q.save(); Q.globalAlpha = a;
    Q.beginPath(); Q.moveTo(x - 8, y + 10); Q.lineTo(x, y + 21); Q.lineTo(x + 8, y + 10); Q.closePath(); ink(col, 3);
    rr(x - 22, y - 12, 44, 24, 12); ink(col, 3); Q.fillStyle = 'rgba(255,255,255,.35)'; rr(x - 16, y - 9, 32, 6, 3); Q.fill();
    star5(x, y + 1, 8.5, 4, 5, -Math.PI / 2, '#fff', 2); Q.restore();
  };
  const orbitStars = (x, y, T, n = 3, r = 30) => { for (let i = 0; i < n; i++) { const a = T * 6 + i * TAU / n; star5(x + Math.cos(a) * r, y + Math.sin(a) * r * .38, 8, 3.6, 5, T * 3 + i, '#FFE14D', 2.5); } };
  /* comic starburst (the crash / bonk shape) */
  const comic = (x, y, r, n, rot, fill, o = 4) => { Q.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, q = i % 2 ? r * .62 : r * (1 + .08 * Math.sin(i * 3.1)); Q.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } Q.closePath(); ink(fill, o); };
  /* themed progress: a wooden planter plank with slots. icon(i, x, y, s) draws a filled slot, popT = seconds since the last slot filled */
  const slotsHud = (n, need, popT, icon) => {
    const sp = 38, w = need * sp + 26, x0 = W / 2 - w / 2, y0 = 62, h = 36;
    Q.save(); Q.fillStyle = 'rgba(20,16,28,.3)'; rr(x0 + 4, y0 + 7, w, h, 16); Q.fill();
    rr(x0, y0 + 5, w, h, 16); ink('#a5622c', 3.5); rr(x0, y0, w, h, 16); ink('#d9944f', 3.5);
    Q.fillStyle = 'rgba(255,255,255,.3)'; rr(x0 + 10, y0 + 4, w - 20, 5, 3); Q.fill();
    for (let i = 0; i < need; i++) {
      const cx = x0 + 13 + sp / 2 + i * sp, cy = y0 + h / 2;
      el(cx, cy + 2, 13, 11); ink('#6b3f1d', 2);
      if (i < n) { const k = i === n - 1 ? outBack(popT / .25) : 1; icon(i, cx, cy, Math.max(.01, k)); }
    }
    Q.restore();
  };
  const carrotIcon = (i, x, y, s) => {
    Q.save(); Q.translate(x, y); Q.scale(s, s); Q.lineCap = 'round';
    for (const a of [-.5, 0, .5]) { Q.beginPath(); Q.moveTo(0, -4); Q.lineTo(Math.sin(a) * 10, -15); Q.lineWidth = 8; Q.strokeStyle = INK; Q.stroke(); Q.lineWidth = 3.5; Q.strokeStyle = '#4fd06a'; Q.stroke(); }
    Q.beginPath(); Q.moveTo(-8, -6); Q.lineTo(8, -6); Q.lineTo(0, 15); Q.closePath(); ink('#ff8a3d', 3); Q.strokeStyle = '#c4531a'; Q.lineWidth = 2; Q.beginPath(); Q.moveTo(-4, -1); Q.lineTo(0, -1); Q.moveTo(-2, 5); Q.lineTo(3, 5); Q.stroke(); Q.restore();
  };
  const fruitIcon = (i, x, y, s) => {
    Q.save(); Q.translate(x, y); Q.scale(s, s); const cols = ['#7ed957', '#ffa62b', '#ffe14d', '#c77dff'];
    Q.beginPath(); Q.arc(0, 1, 10.5, 0, TAU); ink(cols[i % 4], 3); glint(-3.5, -3, 4, 2.6, .6, -.6);
    Q.beginPath(); Q.moveTo(0, -9); Q.lineTo(1, -15); Q.lineWidth = 6; Q.strokeStyle = INK; Q.stroke(); Q.lineWidth = 2.5; Q.strokeStyle = '#6b3f1d'; Q.stroke();
    el(6, -12, 5, 2.6, -.4); ink('#4fd06a', 2); Q.restore();
  };

  /* payoffs that read around the centre stamp: icons raining down across the whole screen */
  const rainIcons = (oT, n, fn) => { for (let i = 0; i < n; i++) { const t0 = oT - hash(i + 3) * .3; if (t0 <= 0) continue; const x = -OX + 36 + hash(i) * (VW - 72), y = 64 + t0 * 520 * (.8 + .4 * hash(i + 9)); if (y < 535) fn(i, x, y, t0); } };
  const bugIcon = (x, y, s, dir, T) => {
    Q.save(); Q.translate(x, y); Q.scale(s * dir, s); Q.lineCap = 'round';
    for (const i of [-1, 0, 1]) for (const k of [-1, 1]) { const w = Math.sin(T * 30 + i * 2 + k) * 3; Q.beginPath(); Q.moveTo(i * 5, 0); Q.lineTo(i * 7 + w, k * 12); Q.lineWidth = 6; Q.strokeStyle = INK; Q.stroke(); Q.lineWidth = 2.5; Q.strokeStyle = '#5a4a72'; Q.stroke(); }
    el(0, 0, 14, 11); ink('#e8433a', 3); Q.fillStyle = INK; for (const [a, b] of [[-4, -4], [3, 3], [-3, 5], [4, -5]]) { Q.beginPath(); Q.arc(a, b, 2.2, 0, TAU); Q.fill(); }
    Q.beginPath(); Q.arc(14, 0, 7, 0, TAU); ink('#3d3158', 2.5); Q.fillStyle = '#fff'; Q.beginPath(); Q.arc(17, -3, 2.2, 0, TAU); Q.fill(); Q.beginPath(); Q.arc(17, 3, 2.2, 0, TAU); Q.fill(); Q.restore();
  };

  /* ───────────── 3D toon kit ───────────── */
  let GRAD = null, INKM = null;
  const gradient = () => GRAD || (GRAD = (() => { const t = new THREE.DataTexture(new Uint8Array([105, 172, 232]), 3, 1, THREE.LuminanceFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; })());
  const TM = {};
  const tm = c => TM[c] || (TM[c] = new THREE.MeshToonMaterial({ color: c, gradientMap: gradient() }));
  const inkM = () => INKM || (INKM = new THREE.MeshBasicMaterial({ color: 0x14101c, side: THREE.BackSide }));
  const BM = {};
  const bm = c => BM[c] || (BM[c] = new THREE.MeshBasicMaterial({ color: c }));
  const hull = (m, k = 1.07) => { const o = new THREE.Mesh(m.geometry, inkM()); o.scale.setScalar(k); o.userData.outline = true; m.add(o); return m; };
  const mb = {
    box: (w, h, d, c, k = 1.07) => hull(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), tm(c)), k),
    sphere: (r, c, k = 1.08) => hull(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), tm(c)), k),
    cyl: (rt, rb, h, c, k = 1.08) => hull(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 18), tm(c)), k),
    cone: (r, h, c, k = 1.08) => hull(new THREE.Mesh(new THREE.ConeGeometry(r, h, 14), tm(c)), k),
    /* torus lies in the XZ plane (like the old torusMesh); the ink hull is a fatter tube seen from behind */
    torus: (r, t, c, ot = .07, flat = true) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 10, 28), tm(c));
      const o = new THREE.Mesh(new THREE.TorusGeometry(r, t + ot, 10, 28), inkM()); o.userData.outline = true; m.add(o);
      if (flat) m.rotation.x = Math.PI / 2; return m;
    },
  };
  const put = (S, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); m.traverse(o => { if (o.isMesh && !o.userData.outline) { o.castShadow = true; o.receiveShadow = true; } }); S.scene.add(m); return m; };
  const flat = (S, w, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), tm(c)); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; S.scene.add(m); return m; };

  /* the 3D Caos hero: blocky crab with real eyes (white, pupil, highlight), cheeks, a mouth and moods.
     g.mood(mood, lookX, lookY, T): idle | eager | panic | happy | sad | dizzy | sick | bonk */
  const hero = (col = OR) => {
    const g = new THREE.Group(), skin = [];
    const part = (w, h, d, x, y, z) => { const m = mb.box(w, h, d, col); m.position.set(x, y, z); g.add(m); skin.push(m); return m; };
    g.body = part(3, 1.75, 1.8, 0, 1.65, 0);
    g.armL = part(.5, .6, .6, -1.75, 1.45, 0); g.armR = part(.5, .6, .6, 1.75, 1.45, 0);
    g.legs = [-1.25, -.65, .35, .95].map(x => part(.3, .8, .4, x + .15, .4, 0));
    const W0 = bm(0xffffff), K0 = bm(0x14101c);
    g.eyeP = [-1, 1].map(s => {
      const e = new THREE.Group(); e.position.set(s * .72, 1.88, .93);
      const w = hull(new THREE.Mesh(new THREE.SphereGeometry(.46, 16, 12), W0), 1.16); w.scale.set(1, 1.1, .45); e.add(w);
      const p = new THREE.Mesh(new THREE.SphereGeometry(.22, 12, 10), K0); p.position.z = .1; p.scale.set(1, 1.05, .5); e.add(p);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), W0); hl.position.set(-.07, .09, .21); p.add(hl); hl.position.set(-.07 / 1, .09 / 1.05, .21 / .5 * .6);
      const arc = new THREE.Mesh(new THREE.TorusGeometry(.32, .085, 6, 14, Math.PI), K0); arc.position.set(0, -.12, .2); arc.visible = false; e.add(arc);
      g.add(e); return { w, p, arc, s };
    });
    g.mouth = new THREE.Group(); g.mouth.position.set(0, 1.18, .93);
    const mk = new THREE.Mesh(new THREE.BoxGeometry(1, 1, .1), K0); g.mouth.add(mk);
    const tg = new THREE.Mesh(new THREE.BoxGeometry(.7, .45, .12), bm(0xff6ea5)); tg.position.set(0, -.22, .02); g.mouth.add(tg); g.tongue = tg; g.mouthM = mk;
    g.add(g.mouth);
    g.cheeks = [-1, 1].map(s => { const c = new THREE.Mesh(new THREE.SphereGeometry(.3, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff6ea5, transparent: true, opacity: .55 })); c.scale.set(1, .6, .2); c.position.set(s * 1.15, 1.42, .93); g.add(c); return c; });
    g.tint = c => { for (const m of skin) m.material = tm(c); };
    g.k = 0;
    g.mood = (m, lx = 0, ly = 0, T = 0) => {
      const blink = m !== 'panic' && Math.sin(T * 1.9 + g.k) > .985;
      g.eyeP.forEach((E, i) => {
        const happy = m === 'happy', bonk = m === 'bonk';
        E.w.visible = !happy; E.p.visible = !happy && !bonk; E.arc.visible = happy;
        const sc = m === 'panic' ? 1.35 : m === 'sad' || m === 'sick' ? .9 : m === 'eager' ? 1.12 : 1;
        E.w.scale.set(sc, sc * 1.1 * (blink ? .14 : bonk ? .2 : 1), .45);
        const ps = m === 'panic' ? .55 : m === 'dizzy' ? .8 : 1; E.p.scale.set(ps, ps * 1.05, .5);
        if (m === 'dizzy' || m === 'sick') { const a = T * 9 + i * 2; E.p.position.set(Math.cos(a) * .17, Math.sin(a) * .17, .1); }
        else E.p.position.set(clamp(lx, -1, 1) * .17, clamp(ly, -1, 1) * .17, .1);
      });
      const mo = g.mouth, tgv = g.tongue;
      tgv.visible = m === 'happy';
      if (m === 'happy') { mo.scale.set(1.25, .5, 1); mo.position.y = 1.12; }
      else if (m === 'panic') { mo.scale.set(.5, .62, 1); mo.position.y = 1.0; }
      else if (m === 'eager') { mo.scale.set(.6, .3, 1); mo.position.y = 1.1; }
      else if (m === 'sad' || m === 'sick') { mo.scale.set(.7 + .1 * Math.sin(T * 14), .14, 1); mo.position.y = .98; }
      else if (m === 'dizzy' || m === 'bonk') { mo.scale.set(.55, .35, 1); mo.position.y = 1.0; }
      else { mo.scale.set(.55, .12, 1); mo.position.y = 1.15; }
      for (const c of g.cheeks) c.material.opacity = m === 'happy' ? .85 : .5;
    };
    g.mood('idle');
    return g;
  };

  /* widescreen: own renderer sized VW×H (the shared T3 one is fixed at 800×600), camera aspect follows VW so wide screens SEE more scene.
     The canvas is transparent so the painted 2D place can sit behind the 3D layer. */
  const X = {
    R: null, bad: false,
    init() {
      if (X.R || X.bad) return;
      try {
        const c = document.createElement('canvas'); c.width = VW; c.height = H;
        X.R = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
        X.R.setPixelRatio(1); X.R.setClearColor(0x000000, 0); X.R.shadowMap.enabled = true; X.R.shadowMap.type = THREE.PCFSoftShadowMap;
      } catch (e) { X.bad = true; X.R = null; }
    },
    render(S) {
      X.init();
      const R = X.R; if (!R) { T3.render(S); return; }
      if (R.domElement.width !== VW) R.setSize(VW, H, false);
      if (Math.abs(S.camera.aspect - VW / H) > 1e-4) { S.camera.aspect = VW / H; S.camera.updateProjectionMatrix(); }
      S.camera.updateMatrixWorld(); R.render(S.scene, S.camera); ctx.drawImage(R.domElement, -OX, 0, VW, H);
    },
    /* canvas px (game coords, may be <0 / >W) → normalized device coords for raycasting */
    ndc: p => new THREE.Vector2((p.x + OX) / VW * 2 - 1, -(p.y / H) * 2 + 1),
    screen(S, v) { const q = v.clone().project(S.camera); return { x: (q.x + 1) / 2 * VW - OX, y: (1 - q.y) / 2 * H, z: q.z }; },
    ray(S, p, objs) {
      S.ray.setFromCamera(X.ndc(p), S.camera);
      const h = S.ray.intersectObjects(objs || S.scene.children, true).filter(i => !i.object.userData.outline);
      return h[0] || null;
    },
    ground(S, p, h = 0) {
      S.ray.setFromCamera(X.ndc(p), S.camera);
      const r = S.ray.ray; if (Math.abs(r.direction.y) < 1e-4) return null;
      const k = (h - r.origin.y) / r.direction.y; return k < 0 ? null : r.origin.clone().addScaledVector(r.direction, k);
    },
  };
  /* the shared scene lights are tuned for flat Phong; toon needs them calmer so pastel colours do not burn out */
  const tone = (S, k = .7) => { S.scene.traverse(o => { if (o.isHemisphereLight || o.isDirectionalLight) o.intensity *= k; }); };
  /* three.js makes every object UUID with Math.random(). Party mode builds a game from a shared seed, so while a constructor runs Math.random is swapped for a
     throw-away generator and rnd() keeps reading the seeded one: the stream then carries ONLY the game's own rnd() calls (same count and order as always),
     however much art is built. */
  let RN = null;
  const uuidOff = () => { const o = Math.random; let q = 12345; RN = o; Math.random = () => { q = (q * 1664525 + 1013904223) >>> 0; return q / 4294967296; }; return () => { Math.random = o; RN = null; }; };
  const rnd = (a, b) => a + (RN || Math.random)() * (b - a);
  const WK = VW / W;   // widescreen scale for scenery spread (1 in portrait)
  const eoBack = u => { const c = 1.9; u -= 1; return 1 + (c + 1) * u * u * u + c * u * u; };
  /* world point → screen px (scratch vector reuse is not worth it here: a handful of calls per frame) */
  const scr = (S, x, y, z) => X.screen(S, new THREE.Vector3(x, y, z));

  /* ───────────────────────── 1. TUNNEL ─────────────────────────
     Place: the Rubber-Duck Highway, a purple candy tube full of drifting ducks and donuts. Caos rides a hover board. */
  reg3('td_tunnel', sp => {
    const FOG = 0x3d3480;
    const S = T3.scene({ bg: FOG, fog: [16, 72], cam: [0, 1, 2], look: [0, 0, -20], fov: 72 });
    X.init(); if (X.R) S.scene.background = null;
    const uuidBack = uuidOff();
    try {
    S.scene.fog.color.set(FOG); tone(S, .78);
    S.sun.castShadow = false;
    const cr = mulberry32(1101);
    const SZ = -6, SPACING = 24, NW = 6, LX = 6, LY = 4.5;
    const v0 = 30 + 9 * sp, gsBase = clamp(3.7 - .7 * (sp - 1), 2.7, 3.7), DUR = 6 / Math.sqrt(sp);
    const BG = new THREE.BoxGeometry(1, 1, 1), FRM = tm(0xffe14d);
    const mats = [0xff6fa0, 0x5ac8fa, 0x7ed957, 0xffa62b].map(tm);
    const box = (parent, m) => { const b = new THREE.Mesh(BG, m); parent.add(b); return b; };
    const setB = (b, x0, x1, y0, y1, z, th) => { b.scale.set(Math.max(.001, x1 - x0), Math.max(.001, y1 - y0), th); b.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); };

    let lastGx = 0, lastGy = 0, passes = 0;
    const walls = [];
    const place = (w, z) => {
      w.z = z; w.passed = false;
      w.gs = gsBase + rnd(-.2, .2);
      w.gx = clamp(lastGx + rnd(-5.5, 5.5), -4, 4); w.gy = clamp(lastGy + rnd(-3.5, 3.5), -3, 3);
      lastGx = w.gx; lastGy = w.gy;
      const { gx, gy, gs } = w, XW = 10 * WK, Y = 8, p = w.pan, f = w.fr;
      setB(p[0], -XW, gx - gs, -Y, Y, 0, 1);
      setB(p[1], gx + gs, XW, -Y, Y, 0, 1);
      setB(p[2], gx - gs, gx + gs, gy + gs, Y, 0, 1);
      setB(p[3], gx - gs, gx + gs, -Y, gy - gs, 0, 1);
      setB(f[0], gx - gs - .35, gx - gs, gy - gs - .35, gy + gs + .35, .6, .3);
      setB(f[1], gx + gs, gx + gs + .35, gy - gs - .35, gy + gs + .35, .6, .3);
      setB(f[2], gx - gs, gx + gs, gy + gs, gy + gs + .35, .6, .3);
      setB(f[3], gx - gs, gx + gs, gy - gs - .35, gy - gs, .6, .3);
      w.g.position.z = z;
    };
    for (let i = 0; i < NW; i++) {
      const g = new THREE.Group(), m = mats[i % mats.length];
      const w = { g, pan: [0, 1, 2, 3].map(() => box(g, m)), fr: [0, 1, 2, 3].map(() => hull(box(g, FRM), 1.09)) };
      S.scene.add(g); walls.push(w); place(w, -50 - i * SPACING);
    }
    /* square rings rushing past */
    const rings = [], RN = 9, RS = 10, ringCols = [0x5ac8fa, 0xff6fa0];
    for (let i = 0; i < RN; i++) {
      const g = new THREE.Group(), m = bm(ringCols[i % 2]);
      const RX = 10 * WK;
      setB(box(g, m), -RX - .3, RX + .3, 7.7, 8.0, 0, .3); setB(box(g, m), -RX - .3, RX + .3, -8.0, -7.7, 0, .3);
      setB(box(g, m), -RX - .3, -RX, -8, 8, 0, .3); setB(box(g, m), RX, RX + .3, -8, 8, 0, .3);
      g.position.z = 3 - i * RS; S.scene.add(g); rings.push(g);
    }
    /* streaking lights */
    const streaks = [], SM = [0xffffff, 0x9ff3ff, 0xffd1f0].map(bm);
    for (let i = 0; i < 40; i++) {
      const b = box(S.scene, SM[i % 3]); b.scale.set(.1, .1, 4);
      b.position.set(rnd(-9.5 * WK, 9.5 * WK), rnd(-7.5, 7.5), rnd(-90, 3)); streaks.push(b);
    }
    /* the highway traffic: rubber ducks and donuts drifting past (decor only, own RNG) */
    const mkDuck = () => {
      const g = new THREE.Group();
      const b = mb.sphere(.8, 0xffe14d); b.scale.set(1, .8, 1.2); g.add(b);
      const h = mb.sphere(.5, 0xffe14d); h.position.set(0, .8, .7); g.add(h);
      const k = mb.cone(.2, .5, 0xff8a3d); k.rotation.x = Math.PI / 2; k.position.set(0, .75, 1.2); g.add(k);
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 6), bm(0x14101c)); e.position.set(s * .27, .95, 1.05); g.add(e); }
      const w = mb.sphere(.38, 0xffcc2e); w.scale.set(.4, .7, 1); w.position.set(.78, .15, -.1); g.add(w); const w2 = w.clone(); w2.position.x = -.78; g.add(w2);
      return g;
    };
    const mkDonut = () => {
      const g = new THREE.Group(), t = mb.torus(.8, .38, 0xe3a868, .08, false); g.add(t);
      const gz = new THREE.Mesh(new THREE.TorusGeometry(.8, .3, 8, 24), tm([0xff8fb1, 0x7a4a2a, 0x9ff3ff][Math.floor(cr() * 3)])); gz.position.z = .14; gz.scale.set(1, 1, .6); g.add(gz);
      return g;
    };
    const props = [];
    for (let i = 0; i < 16; i++) {
      const g = i % 4 === 3 ? mkDonut() : mkDuck(); g.scale.setScalar(.9 + cr() * .5);
      const side = cr() < .5 ? -1 : 1; let x = side * (5.5 + cr() * 4) * WK, y = (cr() * 2 - 1) * 6.5;
      g.position.set(x, y, -16 - cr() * 76); g.userData.spin = (cr() - .5) * 2; S.scene.add(g); props.push(g);
    }
    /* ship = Caos on a hover board */
    const ship = new THREE.Group(); S.scene.add(ship); ship.position.set(0, -.4, SZ); ship.scale.setScalar(.62);
    const hr = hero(OR); hr.position.set(0, .1, -.2); ship.add(hr);
    const board = mb.box(3.9, .26, 4.4, 0x5ac8fa, 1.06); board.position.y = -.1; ship.add(board);
    const bstripe = new THREE.Mesh(new THREE.BoxGeometry(3.2, .06, .5), bm(0xffffff)); bstripe.position.set(0, .15, 1.4); ship.add(bstripe);
    const glow = new THREE.Mesh(new THREE.RingGeometry(.8, 1.7, 20), new THREE.MeshBasicMaterial({ color: 0x9ff3ff, transparent: true, opacity: .6, side: THREE.DoubleSide })); glow.rotation.x = -Math.PI / 2; glow.position.y = -.3; ship.add(glow);
    const scarf = mb.box(.5, .12, 2.2, 0xff6fa0, 1.1); scarf.position.set(0, 2.15, -1.9); ship.add(scarf);

    let sx = 0, sy = 0, tx = 0, ty = 0, dead = false, T = 0, vf = .75, kick = 0, camShake = 0, spin = 0, roll = 0, sdx = 0;
    const lines = Array.from({ length: 18 }, (_, i) => ({ a: i / 18 * 6.283 + rnd(-.2, .2), r: rnd(0, 1) }));
    /* art state */
    let oT = 0, crashS = null, danger = 0, scare = 0, debris = [], wonAt = -1;
    const SUN = bake(VW, H, () => { Q.fillStyle = '#3d3480'; Q.fillRect(0, 0, VW, H); });
    const stars = Array.from({ length: 36 }, (_, i) => ({ x: hash(i) * VW - OX, y: hash(i + 50) * H, r: 1.2 + hash(i + 90) * 2.2, p: hash(i + 7) * 6 }));

    const g = {
      wide: true, cmd: 'FLY!', hint: 'STEER THROUGH THE GAPS', thint: 'DRAG TO STEER', dur: 6, timeWin: true,
      move(p) { if (dead) return; tx = clamp((p.x / W * 2 - 1) * LX, -LX, LX); ty = -(p.y / H * 2 - 1) * LY; },
      down(p) { g.move(p); },
      update(dt) {
        dt = Math.min(dt, .033); T += dt; if (g.result) oT += dt;
        const target = dead ? 0 : 1; vf += (target - vf) * Math.min(1, (dead ? 5 : 1.5) * dt);
        const v = v0 * vf;
        if (!dead) {
          const kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
          const ky = (keys.ArrowUp || keys.KeyW ? 1 : 0) - (keys.ArrowDown || keys.KeyS ? 1 : 0);
          if (kx || ky) { tx = clamp(tx + kx * 13 * dt, -LX, LX); ty = clamp(ty + ky * 10 * dt, -LY, LY); }
          const ox = sx; sx += (tx - sx) * Math.min(1, 9 * dt); sy += (ty - sy) * Math.min(1, 9 * dt); sdx = (sx - ox) / dt;
        }
        danger = 0;
        for (const w of walls) {
          const pz = w.z; w.z += v * dt;
          if (w.z > 4) { place(w, w.z - NW * SPACING); continue; }
          w.g.position.z = w.z;
          if (!dead && w.z < SZ - .3 && w.z > SZ - 26) { const m = Math.min(w.gs - Math.abs(sx - w.gx), w.gs - Math.abs(sy - w.gy)); if (m < 1.1) danger = Math.max(danger, 1 - (SZ - w.z) / 26); }
          if (!dead && !w.passed && w.z >= SZ - .3 && pz < SZ + 1) {
            w.passed = true;
            const mx = w.gs - Math.abs(sx - w.gx), my = w.gs - Math.abs(sy - w.gy);
            if (mx < .5 || my < .45) {
              dead = true; g.result = 'lose'; spin = 1; camShake = 1;
              sfx.thud(); sfx.buzz(); shake(14, .4);
              const s = X.screen(S, ship.position); burst(s.x, s.y, '#FFE14D', 22, 340); ring(s.x, s.y, '#fff', 120, .5); crashS = { x: Math.max(140, s.x - 250), y: Math.max(120, s.y - 175) }; floatText('CRASH!', crashS.x, crashS.y - 6, '#ff5a8a', 40);
              for (let i = 0; i < 12; i++) {
                const d = mb.box(.6, .6, .6, [0xff6fa0, 0x5ac8fa, 0x7ed957, 0xffa62b][Math.floor(hash(i + passes) * 4)], 1.08); d.position.set(sx + (cr() - .5) * 2, sy + (cr() - .5) * 2, SZ - .3);
                S.scene.add(d); debris.push({ m: d, vx: (cr() - .5) * 14, vy: (cr() - .3) * 12, vz: 6 + cr() * 8, rx: (cr() - .5) * 12, ry: (cr() - .5) * 12 });
              }
            } else {
              passes++; sfx.blip(passes * 2); sfx.whoosh(true); kick = 1;
              if (Math.min(mx, my) < .9) { const s = X.screen(S, ship.position); floatText('CLOSE!', s.x, s.y - 60, '#9ff3ff', 32); sfx.tickHi(); scare = .6; }
            }
          }
        }
        for (const r of rings) { r.position.z += v * dt; if (r.position.z > 4) r.position.z -= RN * RS; }
        for (const b of streaks) {
          b.position.z += v * 1.15 * dt;
          if (b.position.z > 4) { b.position.z -= 94; b.position.x = rnd(-9.5 * WK, 9.5 * WK); b.position.y = rnd(-7.5, 7.5); }
          b.scale.z = 3 + v * .06;
        }
        for (const p of props) { p.position.z += v * dt; if (p.position.z > -10) { p.position.z -= 84; const side = cr() < .5 ? -1 : 1; p.position.x = side * (5.5 + cr() * 4) * WK; p.position.y = (cr() * 2 - 1) * 6.5; } p.rotation.y += p.userData.spin * dt; p.rotation.z = Math.sin(T * 2 + p.position.x) * .25; }
        for (const l of lines) { l.r += dt * (.9 + vf); if (l.r > 1) { l.r = 0; l.a = rnd(0, 6.283); } }
        for (let i = debris.length - 1; i >= 0; i--) { const d = debris[i]; d.vy -= 20 * dt; d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z = Math.min(SZ + 1.5, d.m.position.z + d.vz * dt * .3); d.m.rotation.x += d.rx * dt; d.m.rotation.y += d.ry * dt; if (d.m.position.y < -12) { S.scene.remove(d.m); debris.splice(i, 1); } }
        /* ship pose */
        ship.position.x = sx; ship.position.y = sy - .4;
        if (!dead) { roll += ((-sdx * .045) - roll) * Math.min(1, 10 * dt); ship.rotation.z = roll; ship.rotation.x = clamp((ty - sy) * -.05, -.3, .3) + Math.sin(T * 9) * .02; ship.rotation.y = 0; }
        else { ship.rotation.x += 7 * dt * spin; ship.rotation.z += 5 * dt * spin; ship.position.y += 1.5 * dt; spin *= .985; }
        if (g.result === 'win') { if (wonAt < 0) wonAt = T; ship.rotation.z = -Math.min(1, (T - wonAt) / .55) * TAU; ship.position.y = sy - .4 + Math.sin(Math.min(1, (T - wonAt) / .8) * Math.PI) * 1.2; }
        for (let i = 0; i < 4; i++) hr.legs[i].rotation.x = Math.sin(T * 20 + i) * .5;
        hr.armL.rotation.z = Math.sin(T * 12) * .4; hr.armR.rotation.z = -Math.sin(T * 12) * .4;
        scarf.rotation.x = Math.sin(T * 14) * .25; scarf.position.y = 2.15 + Math.sin(T * 14) * .1;
        glow.scale.setScalar(1 + .12 * Math.sin(T * 18)); glow.material.opacity = .5 + .15 * Math.sin(T * 9);
        scare = Math.max(0, scare - dt);
        const mood = g.result === 'win' ? 'happy' : dead ? 'dizzy' : (danger > .35 || scare > 0) ? 'panic' : 'idle';
        hr.mood(mood, clamp(sdx * .08, -1, 1), (ty - sy) * .15, T);
        if (mood === 'happy') { hr.armL.rotation.z = Math.sin(T * 20) * .5 + .6; hr.armR.rotation.z = -Math.sin(T * 20) * .5 - .6; }
        /* camera: follows the ship loosely, FOV pulses on each gap */
        kick *= Math.pow(.02, dt); camShake *= Math.pow(.03, dt);
        const c = S.camera;
        c.position.set(sx * .55 + (Math.random() - .5) * camShake * .6, sy * .55 + 1.1 + (Math.random() - .5) * camShake * .6, 2);
        c.up.set(Math.sin(roll * 1.5), Math.cos(roll * 1.5), 0);
        c.lookAt(sx * .3, sy * .3, -20);
        c.fov = 70 + 8 * vf + kick * 6 + Math.sin(T * 3) * .6; c.updateProjectionMatrix();
      },
      draw() {
        Q = ctx;
        ctx.drawImage(SUN, -OX, 0);
        /* turning light rays + twinkling stars behind the 3D layer */
        ctx.save(); ctx.translate(W / 2, H / 2 - 10); ctx.rotate(T * .18); ctx.fillStyle = 'rgba(122,104,240,.22)';
        for (let i = 0; i < 14; i++) { ctx.rotate(TAU / 14); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1400, -110); ctx.lineTo(1400, 110); ctx.fill(); }
        ctx.restore();
        const gl = ctx.createRadialGradient(W / 2, H / 2 - 10, 10, W / 2, H / 2 - 10, 300); gl.addColorStop(0, 'rgba(255,200,240,.35)'); gl.addColorStop(1, 'rgba(255,200,240,0)'); ctx.fillStyle = gl; ctx.fillRect(-OX, 0, VW, H);
        for (const s of stars) { const a = .45 + .45 * Math.sin(T * 3 + s.p); ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); }
        X.render(S);
        ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineCap = 'round';
        for (const l of lines) {
          const r0 = 120 + l.r * l.r * 520, r1 = r0 + 30 + l.r * 90 * vf, cs = Math.cos(l.a), sn = Math.sin(l.a);
          ctx.globalAlpha = Math.min(1, l.r * 2) * (1 - l.r * .5) * .8; ctx.lineWidth = 1 + l.r * 3;
          ctx.beginPath(); ctx.moveTo(W / 2 + cs * r0 * 1.3 * WK, H / 2 + sn * r0); ctx.lineTo(W / 2 + cs * r1 * 1.3 * WK, H / 2 + sn * r1); ctx.stroke();
        }
        ctx.restore(); ctx.globalAlpha = 1;
        /* overlays */
        const sp2 = X.screen(S, new THREE.Vector3(ship.position.x, ship.position.y + 2.2, SZ));
        if (!g.result) {
          if (T < 2.6) tag(sp2.x, sp2.y - 26, T < 2 ? 1 : (2.6 - T) / .6);
          if (danger > .35 || scare > 0) sweat(sp2.x + 22, sp2.y - 4, 1.1, T);
        }
        if (g.result === 'lose' && crashS) {
          const k = outBack(oT / .22), fade = oT < .55 ? 1 : clamp(1 - (oT - .55) / .3, 0, 1);
          if (fade > 0) { Q.save(); Q.globalAlpha = fade; comic(crashS.x, crashS.y, 112 * k, 10, .2, '#ff6fa0', 5); comic(crashS.x, crashS.y, 78 * k, 10, .5, '#FFE14D', 3); Q.restore(); }
          orbitStars(sp2.x, sp2.y - 8, T, 3, 34);
        }
        if (g.result === 'win') {
          const k = ease(oT / .4);
          Q.save(); Q.translate(sp2.x, sp2.y + 40); Q.rotate(T * .8); Q.fillStyle = 'rgba(255,240,150,.5)';
          for (let i = 0; i < 10; i++) { Q.rotate(TAU / 10); Q.beginPath(); Q.moveTo(-10, 40 * k); Q.lineTo(10, 40 * k); Q.lineTo(0, 190 * k); Q.fill(); }
          Q.restore();
          for (let i = 0; i < 5; i++) { const t0 = oT - i * .09; if (t0 > 0) heart(sp2.x + (i - 2) * 34, sp2.y - 10 - t0 * 110, 1.05, clamp(1.3 - t0 * 1.3, 0, 1)); }
        }
        /* progress: a light-rail with a duck racing to the checkered flag */
        if (!g.result || T < DUR + .1) {
          const pw = 250, px = W / 2 - pw / 2, py = 64, k = clamp(T / DUR, 0, 1);
          Q.save(); Q.fillStyle = 'rgba(20,16,28,.3)'; rr(px + 3, py + 6, pw, 20, 10); Q.fill();
          rr(px, py, pw, 20, 10); ink('#4a3fa0', 3.5); rr(px + 4, py + 4, Math.max(.01, (pw - 8) * k), 12, 6); Q.fillStyle = '#9ff3ff'; Q.fill();
          Q.fillStyle = 'rgba(255,255,255,.4)'; rr(px + 8, py + 5, pw - 16, 3, 2); Q.fill();
          const dx = px + 10 + (pw - 20) * k; Q.beginPath(); Q.arc(dx, py + 10, 11, 0, TAU); ink('#ffe14d', 3); el(dx + 8, py + 12, 6, 3.5); ink('#ff8a3d', 2); Q.fillStyle = INK; Q.beginPath(); Q.arc(dx + 3, py + 6, 2, 0, TAU); Q.fill();
          const fx = px + pw + 6; Q.fillStyle = INK; Q.fillRect(fx, py - 6, 3, 30);
          for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { Q.fillStyle = (i + j) % 2 ? '#fff' : INK; Q.fillRect(fx + 3 + j * 7, py - 6 + i * 7, 7, 7); }
          Q.restore();
        }
        vignette(.38);
      }
    };
    return g;
    } finally { uuidBack(); }
  }, 'Fly');

  /* ───────────────────────── 2. MOLE ─────────────────────────
     Place: Grandma's vegetable patch, a picket fence, a hedge, sunflowers and one very relaxed chicken. Caos the gardener watches. */
  reg3('td_mole', sp => {
    const S = T3.scene({ bg: 0x9ad8ff, ground: 0x7ed957, cam: [0, 10, 8.6], look: [0, 0, .6], fov: 48, sun: [4, 12, 6] });
    const uuidBack = uuidOff();
    try {
    S.floor.material = tm(0x7ed957); tone(S);
    const cr = mulberry32(1102);
    const need = 5 + (sp > 1.4 ? 1 : 0) + (sp > 1.8 ? 1 : 0);
    const holes = [];
    /* lawn: mowed stripes + the dirt bed */
    for (let i = -6; i <= 6; i++) if (i % 2) flat(S, 2.4, 40, 0x93e46c, i * 2.4 * 1.0, .015, -4);
    const bed = hull(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .08, 40), tm(0xa87445)), 1.012); bed.scale.set(7.3, 1, 5.7); put(S, bed, 0, .02, 0.05);
    const bed2 = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .09, 40), tm(0x8f5f36)); bed2.scale.set(6.4, 1, 4.8); bed2.position.set(0, .03, .05); S.scene.add(bed2);
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 3.3, z = (j - 1) * 2.8;
      const d = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, .06, 28), bm(0x2b1a12)); d.position.set(x, .1, z); S.scene.add(d);
      const m = mb.torus(1.12, .3, 0x8a5a2e, .07); m.position.set(x, .08, z); m.scale.z = .6; m.receiveShadow = true; S.scene.add(m);
      holes.push({ x, z, c: null });
    }
    /* flowers: SAME two rnd() calls per iteration as before, decor only */
    for (let i = 0; i < Math.round(16 * WK); i++) {
      const x = rnd(-9 * WK, 9 * WK), z = rnd(-6, 6); if (holes.some(h => Math.hypot(h.x - x, h.z - z) < 1.8) || (Math.abs(x) < 6.4 && Math.abs(z) < 4.8)) continue;
      const col = i % 2 ? 0xff7fb0 : 0xffe14d;
      const st = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .5, 5), tm(0x2f9a3a)); st.position.set(x, .25, z); S.scene.add(st);
      const f = mb.sphere(.2, col, 1.2); f.position.set(x, .55, z); f.scale.y = .7; put(S, f, x, .55, z);
    }
    /* garden props (all decor) */
    const cabbage = (x, z) => { const a = mb.sphere(.62, 0x5fc86a); a.scale.y = .85; put(S, a, x, .5, z); const b = mb.sphere(.4, 0x8be08a, 1.1); put(S, b, x, .7, z); };
    for (const [x, z] of [[-6.6, -2.5], [-7.3, 0.6], [6.7, 3.1], [7.4, -1.2], [-6.4, 4.2], [6.2, -4.1]]) { if (Math.abs(x) > 8.6 * WK) continue; cabbage(x, z); }
    const carrotTop = (x, z) => { for (let k = 0; k < 3; k++) { const c = mb.cone(.14, 1, 0x4fd06a, 1.1); c.rotation.z = (k - 1) * .45; put(S, c, x + (k - 1) * .2, .55, z); } const o = mb.cone(.2, .5, 0xff8a3d, 1.1); o.rotation.x = Math.PI; put(S, o, x, .1, z); };
    for (const [x, z] of [[-5.8, 4.4], [5.9, 4.5], [7.2, 1.7], [-7.4, -3.9]]) { if (Math.abs(x) > 8.6 * WK) continue; carrotTop(x, z); }
    /* picket fence + hedge + sunflowers */
    const hedge = mb.box(60, 3.2, 1.6, 0x2f9a55, 1.012); put(S, hedge, 0, 1.6, -9.2);
    const hedgeTop = new THREE.Mesh(new THREE.BoxGeometry(60, .5, 1.6), tm(0x3fb260)); hedgeTop.position.set(0, 3.2, -9.2); S.scene.add(hedgeTop);
    for (let i = 0; i < Math.round(26 * WK); i++) { const x = (i - Math.round(26 * WK) / 2) * .95; const p = mb.box(.62, 2, .16, 0xfff1d0, 1.12); put(S, p, x, 1, -7); const t = mb.cone(.4, .5, 0xfff1d0, 1.12); t.rotation.y = Math.PI / 4; put(S, t, x, 2.2, -7); }
    const rail = mb.box(60, .22, .14, 0xe3c8a0, 1.1); put(S, rail, 0, 1.45, -6.9); put(S, mb.box(60, .22, .14, 0xe3c8a0, 1.1), 0, .55, -6.9);
    const sunfl = [];
    for (const x of [-8.5, -4.6, 3.8, 8.2, -12, 12.5]) {
      if (Math.abs(x) > 8.8 * WK) continue;
      const g = new THREE.Group(); const st = mb.cyl(.09, .09, 3.4, 0x2f9a3a, 1.2); st.position.y = 1.7; g.add(st);
      const pet = mb.torus(.75, .24, 0xffe14d, .06, false); pet.position.y = 3.5; pet.scale.z = .5; g.add(pet);
      const ctr = mb.cyl(.62, .62, .2, 0x6b3f1d, 1.06); ctr.rotation.x = Math.PI / 2; ctr.position.set(0, 3.5, .08); g.add(ctr);
      g.position.set(x, 0, -8.2); put(S, g, x, 0, -8.2); sunfl.push(g);
    }
    /* the chicken (background gag): strolls along the fence and pecks */
    const chick = new THREE.Group();
    { const b = mb.sphere(.6, 0xffffff); b.scale.set(1, .9, 1.25); b.position.y = .85; chick.add(b);
      const tl = mb.sphere(.35, 0xfff3e0); tl.position.set(0, 1.05, -.8); chick.add(tl);
      const hd = new THREE.Group(); hd.position.set(0, 1.55, .5); chick.add(hd); chick.head = hd;
      const hs = mb.sphere(.34, 0xffffff); hd.add(hs); const cb = mb.box(.12, .28, .3, 0xe8433a, 1.12); cb.position.set(0, .38, 0); hd.add(cb);
      const bk = mb.cone(.12, .32, 0xffa62b, 1.12); bk.rotation.x = Math.PI / 2; bk.position.set(0, -.02, .38); hd.add(bk);
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), bm(0x14101c)); e.position.set(s * .2, .08, .28); hd.add(e); const l = mb.cyl(.05, .05, .5, 0xffa62b, 1.2); l.position.set(s * .25, .25, 0); chick.add(l); } }
    put(S, chick, -4, 0, -6.1);
    const M = mb;
    const mkMole = () => {
      const g = new THREE.Group();
      const b = M.sphere(.78, 0x9a6b43); b.scale.set(1, 1.15, 1); b.position.y = .55; g.add(b);
      const bl = new THREE.Mesh(new THREE.SphereGeometry(.5, 14, 10), tm(0xc9a07a)); bl.scale.set(1, 1, .5); bl.position.set(0, .35, .55); g.add(bl);
      const n = M.sphere(.17, 0xff8fb1, 1.12); n.position.set(0, .6, .78); g.add(n);
      for (const s of [-1, 1]) {
        const e = M.sphere(.19, 0xffffff, 1.12); e.position.set(s * .3, .92, .6); g.add(e);
        const p = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), bm(0x14101c)); p.position.set(s * .3, .92, .78); g.add(p);
        const hlt = new THREE.Mesh(new THREE.SphereGeometry(.03, 6, 4), bm(0xffffff)); hlt.position.set(s * .3 - .03, .96, .86); g.add(hlt);
        const c = M.box(.3, .22, .3, 0xffe9c4); c.position.set(s * .6, .22, .58); g.add(c);
        const ck = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff6ea5, transparent: true, opacity: .6 })); ck.scale.set(1, .6, .3); ck.position.set(s * .5, .55, .66); g.add(ck);
      }
      const th = M.box(.12, .16, .06, 0xffffff, 1.2); th.position.set(-.07, .36, .8); g.add(th); const th2 = th.clone(); th2.position.x = .07; g.add(th2);
      const tongue = new THREE.Mesh(new THREE.BoxGeometry(.22, .2, .05), bm(0xff6ea5)); tongue.position.set(0, .22, .84); tongue.visible = false; g.add(tongue); g.tongue = tongue;
      const hat = hull(new THREE.Mesh(new THREE.SphereGeometry(.52, 16, 8, 0, TAU, 0, Math.PI / 2), tm(0xffd23f)), 1.1); hat.position.set(0, 1.25, .05); hat.rotation.x = -.12; g.add(hat);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(.11, 8, 6), bm(0xffffff)); lamp.position.set(0, 1.5, .45); g.add(lamp);
      return g;
    };
    const mkBug = () => {
      const g = new THREE.Group();
      const b = M.sphere(.72, 0xe8433a); b.scale.set(1, .85, 1.15); b.position.y = .52; g.add(b);
      const h = M.sphere(.4, 0x2b2342); h.position.set(0, .55, .78); g.add(h);
      for (const [x, z] of [[-.35, -.15], [.35, -.15], [0, -.5], [0, .2]]) { const d = M.sphere(.13, 0x14101c, 1); d.position.set(x, .98 - Math.abs(z) * .1, z); g.add(d); }
      for (const s of [-1, 1]) {
        const e = M.sphere(.15, 0xffffff, 1.12); e.position.set(s * .2, .7, 1.08); g.add(e);
        const p = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), bm(0x14101c)); p.position.set(s * .2, .68, 1.2); g.add(p);
        const br = new THREE.Mesh(new THREE.BoxGeometry(.3, .07, .05), bm(0xffffff)); br.position.set(s * .2, .9, 1.12); br.rotation.z = -s * .45; g.add(br);
        const a = M.cyl(.04, .04, .6, 0x14101c, 1); a.position.set(s * .25, 1.0, .9); a.rotation.z = -s * .5; g.add(a);
      }
      const tongue = new THREE.Mesh(new THREE.BoxGeometry(.2, .18, .05), bm(0xff6ea5)); tongue.position.set(0, .45, 1.2); tongue.visible = false; g.add(tongue); g.tongue = tongue;
      return g;
    };
    const pool = [];
    for (let i = 0; i < 3; i++) for (const k of ['mole', 'bug']) {
      const g = k === 'mole' ? mkMole() : mkBug(); g.visible = false;
      const c = { g, kind: k, state: 'off', t: 0, h: 0, hole: null, life: 1 }; g.userData.crit = c; T3.add(S, g); pool.push(c);
    }
    /* mallet */
    const mal = new THREE.Group(), head = M.cyl(.5, .5, 1.2, 0xe8433a); head.rotation.z = Math.PI / 2; mal.add(head);
    const handle = M.cyl(.12, .12, 2.6, 0xc98a3d); handle.position.y = 1.3; mal.add(handle);
    for (const s of [-1, 1]) { const band = M.cyl(.53, .53, .12, 0xffe14d, 1.04); band.rotation.z = Math.PI / 2; band.position.x = s * .5; mal.add(band); }
    T3.add(S, mal, [0, 2, 1]);
    /* Caos the gardener, bottom-left, straw hat */
    const hr = hero(OR); hr.k = 1.3; const hat = mb.cyl(1.7, 1.7, .14, 0xe9c25a, 1.04); hat.position.set(0, 2.78, 0); hr.add(hat); const crown = mb.cyl(1.0, 1.1, .6, 0xe9c25a, 1.06); crown.position.set(0, 3.1, 0); hr.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, .2, 18), tm(0xe8433a)); band.position.y = 2.95; hr.add(band);
    hr.scale.setScalar(.5); T3.add(S, hr, [-6.0, 0, -2.4]);
    /* gold carrots for the win */
    const golds = [];
    for (const [x, z] of [[-3.3, -2.8], [3.3, -2.8], [-3.3, 2.8], [3.3, 2.8]]) {
      const g = new THREE.Group(); const c = mb.cone(.55, 1.6, 0xffc23a, 1.1); c.rotation.x = Math.PI; c.position.y = .8; g.add(c);
      for (let k = 0; k < 3; k++) { const l = mb.cone(.14, 1, 0x4fd06a, 1.1); l.position.set((k - 1) * .22, 1.9, 0); l.rotation.z = (k - 1) * .45; g.add(l); }
      g.position.set(x, -2.4, z); g.visible = false; T3.add(S, g); golds.push(g);
    }

    let count = 0, spawnT = .35, T = 0, sw = 0, mx = 0, mz = 1, gp = null, cam = 0;
    let oT = 0, popT = 9, happyT = 0, taunted = false, nearAny = 0;
    const life = clamp(1.1 - .22 * (sp - 1), .65, 1.1), maxAct = sp > 1.5 ? 3 : 2;
    const active = () => pool.filter(c => c.state === 'rise' || c.state === 'hold');
    const wp = new THREE.Vector3();

    function whack(c) {
      c.state = 'hit'; c.t = 0; count++; popT = 0; happyT = .7;
      wp.set(c.hole.x, 1, c.hole.z); const s = X.screen(S, wp);
      if (c.kind === 'bug') sfx.splat(); else sfx.boing();
      sfx.hit(); sfx.thud(); sfx.blip(count * 2); shake(7, .18); cam = 1;
      burst(s.x, s.y, c.kind === 'bug' ? '#e8433a' : '#c98a3d', 14); burst(s.x, s.y, '#FFE14D', 8, 200); ring(s.x, s.y, '#fff', 80);
      floatText(['BONK!', 'WHACK!', 'POW!', 'SMASH!'][Math.floor(Math.random() * 4)], s.x, s.y - 40, '#FFE14D', 34);
      if (count >= need && !g.result) { g.result = 'win'; sfx.sparkle(); confetti(W / 2, H / 2, 50); }
    }
    const g = {
      wide: true, cmd: 'WHACK!', hint: 'CLICK THE MOLES AND BUGS', thint: 'TAP THE MOLES', dur: 7,
      move(p) { const q = X.ground(S, p, .3); if (q) { gp = q; } },
      down(p) {
        if (g.result) return; g.move(p); sw = .28; sfx.whoosh(false);
        let hit = null;
        const act = active(), r = act.length ? X.ray(S, p, act.map(c => c.g)) : null;
        if (r) { let o = r.object; while (o && !o.userData.crit) o = o.parent; if (o) hit = o.userData.crit; }
        if (!hit && gp) { let bd = 1.35; for (const c of act) { const d = Math.hypot(gp.x - c.hole.x, gp.z - c.hole.z); if (d < bd && c.h > .3) { bd = d; hit = c; } } }
        if (hit) whack(hit);
        else { sfx.miss(); ring(p.x, p.y, 'rgba(255,255,255,.8)', 50, .3); }
      },
      update(dt) {
        dt = Math.min(dt, .05); T += dt; cam *= Math.pow(.02, dt); popT += dt; happyT = Math.max(0, happyT - dt); if (g.result) oT += dt;
        if (!g.result) {
          spawnT -= dt;
          if (spawnT <= 0 && active().length < maxAct) {
            const free = holes.filter(h => !h.c), fp = pool.filter(c => c.state === 'off');
            if (free.length && fp.length) {
              const want = Math.random() < .35 ? 'bug' : 'mole';
              const c = fp.find(f => f.kind === want) || fp[0], h = free[Math.floor(Math.random() * free.length)];
              c.hole = h; h.c = c; c.state = 'rise'; c.t = 0; c.life = life * rnd(.85, 1.15); c.g.position.set(h.x, -2, h.z); sfx.tick();
            }
            spawnT = (.4 + Math.random() * .35) / Math.sqrt(sp);
          }
        }
        /* art-only: after a loss every critter pops up laughing, after a win they all duck */
        if (g.result === 'lose' && !taunted) {
          taunted = true;
          for (const c of pool) if (c.state === 'rise' || c.state === 'hold') c.life = 99;
          const free = holes.filter(h => !h.c).sort((a, b) => (Math.abs(b.x) + Math.abs(b.z)) - (Math.abs(a.x) + Math.abs(a.z)));
          for (const c of pool) if (c.state === 'off' && free.length) { const h = free.shift(); c.hole = h; h.c = c; c.state = 'taunt'; c.t = 0; c.g.position.set(h.x, -2, h.z); c.g.userData.crit = c; }
        }
        if (g.result === 'win') for (const c of pool) if (c.state === 'rise' || c.state === 'hold') c.life = 0;
        for (const c of pool) {
          if (c.state === 'off') continue;
          c.t += dt; let sy = 1, sx = 1, h = 0;
          if (c.state === 'rise') { const u = Math.min(1, c.t / .16); h = eoBack(u); sy = 1 + .25 * Math.sin(u * Math.PI); sx = 1 / Math.sqrt(sy); if (c.t >= .16) { c.state = 'hold'; c.t = 0; } }
          else if (c.state === 'hold') { h = 1; sy = 1 + .04 * Math.sin(T * 16); sx = 1 / Math.sqrt(sy); if (c.t > c.life) { c.state = 'sink'; c.t = 0; } }
          else if (c.state === 'sink') { h = Math.max(0, 1 - c.t / .22); sy = .9; sx = 1.05; if (c.t >= .22) { c.state = 'off'; c.hole.c = null; c.hole = null; c.g.visible = false; continue; } }
          else if (c.state === 'taunt') { h = eoBack(Math.min(1, c.t / .22)); sy = 1 + .07 * Math.sin(T * 18 + c.hole.x); sx = 1 / Math.sqrt(sy); }
          else { /* hit: flattened, then drops */
            h = c.t < .1 ? 1 - c.t * .8 : Math.max(0, .92 - (c.t - .1) / .2 * .92); sy = .38; sx = 1.5;
            if (c.t >= .3) { c.state = 'off'; c.hole.c = null; c.hole = null; c.g.visible = false; continue; }
          }
          c.h = h; c.g.visible = h > .03; c.g.position.y = -1.9 + 2.0 * h; c.g.scale.set(sx, sy, sx);
          c.g.rotation.y = c.state === 'hold' ? Math.sin(T * 6 + c.hole.x) * .12 : c.state === 'taunt' ? Math.sin(T * 12 + c.hole.z) * .25 : 0;
          if (c.g.tongue) c.g.tongue.visible = c.state === 'taunt' && Math.sin(T * 14) > -.3;
        }
        /* mallet follows pointer; swing animation */
        if (gp) { mx += (gp.x - mx) * Math.min(1, 25 * dt); mz += (gp.z + .6 - mz) * Math.min(1, 25 * dt); }
        let lift = 2.1, tilt = .5;
        if (sw > 0) { sw -= dt; const p = 1 - sw / .28, d = p < .35 ? p / .35 : 1 - (p - .35) / .65; lift = 2.1 - 1.55 * d; tilt = .5 - .85 * d; }
        mal.position.set(mx, lift, mz); mal.rotation.set(tilt, 0, 0);
        /* art: chicken, sunflowers, gold carrots, Caos */
        const cx = -.6 + Math.sin(T * .33) * 3.6, cdir = Math.cos(T * .33) > 0 ? 1 : -1;
        chick.position.x = cx; chick.rotation.y = cdir > 0 ? Math.PI / 2 : -Math.PI / 2; chick.position.y = Math.abs(Math.sin(T * 5.5)) * .07;
        chick.head.position.y = 1.55 - Math.max(0, Math.sin(T * 2.2)) * .55 * (Math.sin(T * 9) > 0 ? 1 : .7); chick.head.rotation.x = Math.max(0, Math.sin(T * 2.2)) * .9;
        sunfl.forEach((s, i) => { s.rotation.z = Math.sin(T * 1.4 + i) * .05; });
        golds.forEach((gl, i) => { const k = g.result === 'win' ? outBack((oT - .08 - i * .08) / .3) : 0; gl.visible = k > .02; gl.position.y = -2.4 + 2.5 * k + (oT > .6 ? Math.abs(Math.sin(T * 8 + i)) * .2 : 0); gl.rotation.y = T * 2 + i; });
        const lx = (mx + 6.0) * .2, ly = -(mz + 2.4) * .25;
        const left = 7 / Math.sqrt(sp) - T, nearActive = active().length;
        const hm = g.result === 'win' ? 'happy' : g.result === 'lose' ? 'sad' : happyT > 0 ? 'happy' : (left < 2.2 && count < need) ? 'panic' : nearActive ? 'eager' : 'idle';
        hr.mood(hm, clamp(lx, -1, 1), clamp(ly, -1, 1), T);
        hr.position.y = g.result === 'win' ? Math.abs(Math.sin(oT * 9)) * 1.1 : happyT > 0 ? Math.abs(Math.sin(happyT * 10)) * .4 : 0;
        hr.armL.rotation.z = g.result === 'win' || happyT > 0 ? Math.sin(T * 20) * .4 + .8 : 0; hr.armR.rotation.z = -hr.armL.rotation.z;
        hr.rotation.z = g.result === 'lose' ? Math.sin(Math.min(oT, .5) * 6) * .12 : 0;
        const c = S.camera; c.position.set((Math.random() - .5) * cam * .25, 10 + (Math.random() - .5) * cam * .25, 8.6); c.lookAt(0, 0, .6);
      },
      draw() {
        Q = ctx; X.render(S);
        /* 2D on top: stars around bonked critters, Caos's tag, sweat, tears, hearts, the carrot plank */
        for (const c of pool) if (c.state === 'hit') { const s = scr(S, c.hole.x, 1.6, c.hole.z); orbitStars(s.x, s.y, T, 3, 30); comic(s.x, s.y + 18, 26 * outBack(c.t / .1), 8, c.t * 4, '#fff', 3); }
        const hs = scr(S, -6.0, 3.0, -2.4);
        if (!g.result && T < 2.5) tag(hs.x, Math.max(hs.y - 36, 96), T < 1.9 ? 1 : (2.5 - T) / .6);
        if (!g.result && 7 / Math.sqrt(sp) - T < 2.2 && count < need) sweat(hs.x + 26, hs.y - 8, 1.1, T);
        if (g.result === 'lose') { for (const s of [-1, 1]) { const k = (oT * 1.6 + (s > 0 ? .3 : 0)) % 1; Q.save(); Q.globalAlpha = 1 - k; Q.fillStyle = '#9fe3ff'; Q.strokeStyle = INK; Q.lineWidth = 2; el(hs.x + s * 14, hs.y + 6 + k * 40, 4, 6); Q.fill(); Q.stroke(); Q.restore(); } }
        if (g.result === 'win') for (let i = 0; i < 4; i++) { const t0 = oT - i * .1; if (t0 > 0) heart(hs.x + (i - 1.5) * 22, hs.y - 30 - t0 * 90, 1, clamp(1.3 - t0 * 1.4, 0, 1)); }
        slotsHud(count, need, popT, carrotIcon);
        vignette(.18);
      }
    };
    return g;
    } finally { uuidBack(); }
  }, 'Whack');

  /* ───────────────────────── 3. ROLL ─────────────────────────
     Place: a pastry tray on a gingham tablecloth. The ball is a hamster ball with Caos running inside; the holes are donut holes. */
  reg3('td_roll', sp => {
    const S = T3.scene({ bg: 0xffd88a, cam: [0, 11.5, 9.5], look: [0, -.4, .5], fov: 48, sun: [5, 14, 7], ground: 0xf4e6ff });
    X.init(); if (X.R) S.scene.background = null;
    const uuidBack = uuidOff();
    try {
    S.floor.position.y = -3.4; S.floor.material = new THREE.ShadowMaterial({ opacity: .28 }); tone(S);
    const cr = mulberry32(1103);
    const M = mb, piv = new THREE.Group();
    const base = M.box(10.4, .5, 10.4, 0xd9944f, 1.04); piv.add(base);
    const lip = M.box(10.9, .22, 10.9, 0xa5622c, 1.03); lip.position.y = -.28; piv.add(lip);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(1.96, .08, 1.96), tm((i + j) % 2 ? 0xff9fc4 : 0xffc0d8)); t.position.set((i - 2) * 2, .27, (j - 2) * 2); t.receiveShadow = true; piv.add(t);
    }
    const rb = M.box(10.4, .6, .3, 0xe3a868, 1.1); rb.position.set(0, .5, -5.05); piv.add(rb);
    const rl = M.box(.3, .6, 10.4, 0xe3a868, 1.1); rl.position.set(-5.05, .5, 0); piv.add(rl);
    /* layout: start, goal, holes */
    const start = { x: -3.6, z: 3.6 }, goal = { x: rnd(2.6, 3.8), z: rnd(-3.8, -2.6) };
    const holes = [], nh = 3 + Math.round((sp - 1) * 3), HR = .8;
    for (let tries = 0; holes.length < nh && tries < 200; tries++) {
      const h = { x: rnd(-4, 4), z: rnd(-4, 4) };
      if (Math.hypot(h.x - start.x, h.z - start.z) < 2.4 || Math.hypot(h.x - goal.x, h.z - goal.z) < 2.2) continue;
      if (holes.some(o => Math.hypot(o.x - h.x, o.z - h.z) < 2.3)) continue;
      holes.push(h);
    }
    const glazes = [0x7a4a2a, 0xff8fb1, 0xffe14d, 0x9ff3ff];
    holes.forEach((h, hi) => {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(HR, HR, .1, 24), bm(0x14101c)); d.position.set(h.x, .33, h.z); piv.add(d);
      const dn = new THREE.Group(); dn.position.set(h.x, .36, h.z); piv.add(dn); h.dn = dn;
      const r = M.torus(1.08, .33, 0xe3a868, .07); r.scale.z = 1; dn.add(r);
      const gl = new THREE.Mesh(new THREE.TorusGeometry(1.08, .27, 8, 28), tm(glazes[hi % 4])); gl.rotation.x = Math.PI / 2; gl.position.y = .13; gl.scale.set(1, 1, .8); dn.add(gl);
      for (let k = 0; k < 9; k++) { const a = hash(hi * 9 + k) * TAU, s = new THREE.Mesh(new THREE.BoxGeometry(.2, .05, .06), bm([0xffffff, 0x5ac8fa, 0x7ed957, 0xff4d5e][k % 4])); s.position.set(Math.cos(a) * 1.08, .4, Math.sin(a) * 1.08); s.rotation.y = hash(k + hi) * 3; dn.add(s); }
    });
    const gDisc = hull(new THREE.Mesh(new THREE.CylinderGeometry(.95, .95, .12, 28), tm(0xf4fff0)), 1.06); gDisc.position.set(goal.x, .33, goal.z); piv.add(gDisc);
    const gRing = M.torus(.9, .1, 0x7cff6b, .05); gRing.position.set(goal.x, .45, goal.z); piv.add(gRing);
    const pole = M.cyl(.06, .06, 1.8, 0xffffff, 1.4); pole.position.set(goal.x, 1.2, goal.z - .3); piv.add(pole);
    const flag = M.box(.8, .45, .05, 0xe8433a, 1.12); flag.position.set(goal.x + .4, 1.9, goal.z - .3); piv.add(flag);
    const cherry = M.sphere(.22, 0xe8433a, 1.12); cherry.position.set(goal.x, .62, goal.z + .0); piv.add(cherry);
    /* the hamster ball: shell + rings roll, Caos (hb) stays upright inside */
    const ball = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(.72, 22, 16), new THREE.MeshPhongMaterial({ color: 0xcff3ff, transparent: true, opacity: .22, shininess: 80, specular: 0xffffff, depthWrite: false }));
    shell.position.y = .2; ball.add(shell);
    for (const rot of [[0, 0, 0], [Math.PI / 2, 0, 0], [0, 0, Math.PI / 2]]) { const rg = new THREE.Mesh(new THREE.TorusGeometry(.72, .04, 6, 28), bm(0xffffff)); rg.position.y = .2; rg.rotation.set(rot[0], rot[1], rot[2]); ball.add(rg); }
    ball.position.set(start.x, .81, start.z); piv.add(ball);
    const hb = hero(OR); hb.k = .7; hb.scale.setScalar(.3); piv.add(hb);
    T3.add(S, piv, [0, 0, 0]);

    let bx = start.x, bz = start.z, vx = 0, vz = 0, by = .81, vy = 0, state = 'play', fallT = 0, T = 0;
    let nx = 0, nz = 0, rx = 0, rz = 0, cam = 0, hole = null, usingKeys = false;
    let oT = 0, popped = 0, shardS = null;
    const MAXT = .34;
    const wp = new THREE.Vector3();
    const evt = (txtS, col, sz, y = 0.8) => {
      wp.set(bx, y, bz); piv.localToWorld(wp); const s = X.screen(S, wp); return s;
    };
    const TABLE = bake(VW, H, () => {
      Q.translate(OX, 0);
      Q.fillStyle = '#fff6ee'; Q.fillRect(-OX, 0, VW, H);
      for (let i = -4; i < 24; i += 2) { Q.fillStyle = 'rgba(255,90,100,.5)'; Q.fillRect(i * 44, 0, 44, H); }
      for (let j = 0; j < 14; j += 2) { Q.fillStyle = 'rgba(255,90,100,.5)'; Q.fillRect(-OX, j * 44, VW, 44); }
      Q.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 9; i++) { Q.beginPath(); Q.moveTo(-OX + i * 190, 0); Q.lineTo(-OX + i * 190 + 70, 0); Q.lineTo(-OX + i * 190 - 220 + 70, H); Q.lineTo(-OX + i * 190 - 220, H); Q.fill(); }
      /* crumbs + a fork on the cloth (top-down props) */
      for (let i = 0; i < 26; i++) { const x = -OX + hash(i + 3) * VW, y = hash(i + 33) * H; Q.fillStyle = i % 3 ? '#d9a35e' : '#8a5530'; Q.beginPath(); Q.arc(x, y, 2 + hash(i) * 3, 0, TAU); Q.fill(); }
      Q.save(); Q.translate(-OX + 56, 520); Q.rotate(-.35); Q.lineCap = 'round';
      Q.lineWidth = 11; Q.strokeStyle = INK; Q.beginPath(); Q.moveTo(0, -30); Q.lineTo(0, 62); Q.stroke(); for (const s of [-8, 0, 8]) { Q.beginPath(); Q.moveTo(s, -30); Q.lineTo(s, -62); Q.stroke(); }
      Q.lineWidth = 5; Q.strokeStyle = '#d8dfea'; Q.beginPath(); Q.moveTo(0, -30); Q.lineTo(0, 62); Q.stroke(); for (const s of [-8, 0, 8]) { Q.beginPath(); Q.moveTo(s, -30); Q.lineTo(s, -62); Q.stroke(); } Q.restore();
    });
    const cup = (x, y, T) => {
      el(x + 4, y + 7, 46, 44); Q.fillStyle = 'rgba(20,16,28,.28)'; Q.fill();
      Q.beginPath(); Q.arc(x + 48, y, 15, -1.2, 1.2); Q.lineWidth = 16; Q.strokeStyle = INK; Q.stroke(); Q.lineWidth = 7; Q.strokeStyle = '#fff'; Q.stroke();
      Q.beginPath(); Q.arc(x, y, 44, 0, TAU); ink('#fff', 4); Q.beginPath(); Q.arc(x, y, 33, 0, TAU); ink('#7a4a2a', 3); glint(x - 11, y - 11, 11, 5, .35, -.6);
      for (let i = 0; i < 3; i++) { const k = (T * .5 + i / 3) % 1; Q.save(); Q.globalAlpha = Math.sin(k * Math.PI) * .7; Q.strokeStyle = '#fff'; Q.lineWidth = 5; Q.lineCap = 'round'; Q.beginPath(); Q.moveTo(x - 12 + i * 12, y - k * 36); Q.quadraticCurveTo(x - 4 + i * 12 + Math.sin(T * 3 + i) * 7, y - k * 36 - 10, x - 12 + i * 12, y - k * 36 - 20); Q.stroke(); Q.restore(); }
    };
    const fly = (T) => { const a = T * 2.1, x = W - 76 + Math.cos(a * 1.3) * 34 + Math.sin(a * .45) * 24, y = 150 + Math.sin(a) * 26; Q.save(); Q.translate(x, y); Q.rotate(Math.cos(a * 1.3) * .5);
      Q.globalAlpha = .75; el(-6, -5, 6, 3.4, -.5); Q.fillStyle = '#e8f6ff'; Q.fill(); Q.strokeStyle = INK; Q.lineWidth = 1.5; Q.stroke(); el(6, -5, 6, 3.4, .5); Q.fill(); Q.stroke(); Q.globalAlpha = 1; el(0, 0, 4.5, 6.5); ink('#3b3550', 2); Q.restore(); };

    const g = {
      wide: true, cmd: 'ROLL!', hint: 'TILT TO THE GOAL', thint: 'DRAG TO TILT', dur: 8,
      move(p) { if (usingKeys) return; nx = clamp((p.x - W / 2) / (W / 2), -1, 1); nz = clamp((p.y - H / 2) / (H / 2), -1, 1); },
      down(p) { g.move(p); },
      update(dt) {
        dt = Math.min(dt, .033); T += dt; cam *= Math.pow(.02, dt); if (g.result) oT += dt;
        const kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
        const kz = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
        if (kx || kz) { usingKeys = true; nx = kx * .85; nz = kz * .85; } else if (usingKeys) { usingKeys = false; nx = 0; nz = 0; }
        if (g.result === 'win') { nx = 0; nz = 0; }
        /* platform tilt eases to the target (rx tilts +z down, rz tilts +x up) */
        rz += (-nx * MAXT - rz) * Math.min(1, 7 * dt); rx += (nz * MAXT - rx) * Math.min(1, 7 * dt);
        piv.rotation.set(rx, 0, rz);
        if (state === 'play') {
          vx += -Math.sin(rz) * 20 * dt; vz += Math.sin(rx) * 20 * dt;
          const dmp = Math.max(0, 1 - 1.1 * dt); vx *= dmp; vz *= dmp;
          bx += vx * dt; bz += vz * dt;
          if (bx < -4.4) { bx = -4.4; if (vx < -1.5) sfx.tick(); vx = -vx * .4; }
          if (bz < -4.4) { bz = -4.4; if (vz < -1.5) sfx.tick(); vz = -vz * .4; }
          for (const h of holes) if (Math.hypot(bx - h.x, bz - h.z) < .5) {
            state = 'hole'; hole = h; g.result = 'lose'; sfx.miss(); sfx.boing(); shake(8, .25); cam = 1;
            const s = evt(); floatText('PLOP!', s.x, s.y - 40, '#ff5a8a', 40); burst(s.x, s.y, '#FFE14D', 12);
            for (const c of ['#ff4d5e', '#5ac8fa', '#7ed957', '#fff']) burst(s.x, s.y, c, 5, 260);
          }
          if (state === 'play' && (bx > 5.25 || bz > 5.25)) {
            state = 'fall'; g.result = 'lose'; vy = 0; sfx.miss(); sfx.whoosh(false); shake(8, .3); cam = 1;
            const s = evt(); floatText('OOPS!', s.x, s.y - 60, '#ff5a8a', 40);
          }
          if (state === 'play' && Math.hypot(bx - goal.x, bz - goal.z) < .62) {
            state = 'goal'; g.result = 'win'; sfx.sparkle(); sfx.coin(); shake(5, .2); cam = .6;
            const s = evt(); burst(s.x, s.y, '#7cff6b', 20, 320); burst(s.x, s.y, '#FFE14D', 12, 260); ring(s.x, s.y, '#fff', 120, .5); floatText('GOAL!', clamp(s.x, 130, W - 130), Math.min(s.y - 60, 150), '#7cff6b', 48); confetti(s.x, s.y, 50);
          }
          /* roll rotation */
          ball.rotation.z -= vx * dt / .5; ball.rotation.x += vz * dt / .5;
        } else if (state === 'hole') {
          bx += (hole.x - bx) * Math.min(1, 12 * dt); bz += (hole.z - bz) * Math.min(1, 12 * dt);
          fallT += dt; vy -= 22 * dt; by += vy * dt; ball.scale.setScalar(Math.max(.2, 1 - fallT * 1.4));
        } else if (state === 'fall') {
          vx += -Math.sin(rz) * 10 * dt; vz += Math.sin(rx) * 10 * dt; bx += vx * dt; bz += vz * dt; vy -= 30 * dt; by += vy * dt;
        } else if (state === 'goal') {
          bx += (goal.x - bx) * Math.min(1, 8 * dt); bz += (goal.z - bz) * Math.min(1, 8 * dt);
          vy += 14 * dt * Math.sin(T * 30); by = .81 + Math.abs(Math.sin(T * 9)) * .5;
        }
        ball.position.set(bx, by, bz);
        gRing.scale.setScalar(1 + .08 * Math.sin(T * 6)); gRing.position.y = .45 + .05 * Math.sin(T * 4); gRing.rotation.z = T * 2;
        flag.rotation.y = Math.sin(T * 6) * .3;
        /* art: Caos inside the ball runs, looks where it rolls and reacts */
        let near = 9; for (const h of holes) near = Math.min(near, Math.hypot(bx - h.x, bz - h.z));
        const dg = Math.hypot(bx - goal.x, bz - goal.z), spd = Math.hypot(vx, vz);
        const sc = ball.scale.x, edge = Math.max(bx, bz) > 3.9 || Math.min(bx, bz) < -3.9;
        hb.position.set(bx, by + .2 - .5 * sc, bz); hb.scale.setScalar(.3 * sc); hb.rotation.set(-rx - .62, 0, -rz);
        if (state === 'goal') hb.position.y = by + .2 - .5;
        for (let i = 0; i < 4; i++) hb.legs[i].rotation.x = Math.sin(T * 18 + i * 1.6) * clamp(spd * .35, 0, .8);
        const m = state === 'goal' ? 'happy' : state === 'hole' ? (fallT > .35 ? 'dizzy' : 'panic') : state === 'fall' ? 'panic' : (near < 1.9 || edge) ? 'panic' : dg < 2.2 ? 'eager' : 'idle';
        hb.mood(m, clamp(vx * .35, -1, 1), clamp(-vz * .35, -1, 1), T);
        hb.armL.rotation.z = state === 'hole' || state === 'fall' ? Math.sin(T * 24) * .7 + .9 : state === 'goal' ? Math.sin(T * 20) * .4 + .8 : 0; hb.armR.rotation.z = -hb.armL.rotation.z;
        if (state === 'hole') for (const h of holes) h.dn.scale.setScalar(h === hole ? 1 + .07 * Math.sin(fallT * 34) : 1);
        if (state === 'goal') { popped = Math.min(1, popped + dt / .22); shell.scale.setScalar(Math.max(.01, 1 - popped)); for (const o of ball.children) if (o !== shell) o.visible = popped < 1; if (popped >= 1 && !shardS) { const s = evt(); shardS = s; for (const c of ['#cff3ff', '#fff', '#ffe14d']) burst(s.x, s.y, c, 8, 260); } hb.position.y += Math.abs(Math.sin(oT * 9)) * .8; }
        const c = S.camera; c.position.set(rz * -3 + (Math.random() - .5) * cam * .3, 11.5 + (Math.random() - .5) * cam * .3, 9.5 - (state === 'fall' ? Math.min(2, fallT) : 0)); c.lookAt(0, -.4, .5);
        if (state === 'fall') fallT += dt;
      },
      draw() {
        Q = ctx; ctx.drawImage(TABLE, -OX, 0);
        cup(W + OX - 70, 505, T); fly(T);
        X.render(S);
        /* the ball's inked rim + glint, the name tag, sweat, hearts, tears */
        const bp = new THREE.Vector3(bx, by + .2, bz); piv.localToWorld(bp); const b0 = X.screen(S, bp);
        const rg = new THREE.Vector3().setFromMatrixColumn(S.camera.matrixWorld, 0).multiplyScalar(.72 * ball.scale.x), b1 = X.screen(S, bp.clone().add(rg));
        const br = Math.hypot(b1.x - b0.x, b1.y - b0.y);
        if (state !== 'goal' || popped < 1) { Q.save(); Q.globalAlpha = state === 'goal' ? 1 - popped : 1; Q.beginPath(); Q.arc(b0.x, b0.y, br, 0, TAU); Q.lineWidth = 4; Q.strokeStyle = INK; Q.stroke(); glint(b0.x - br * .45, b0.y - br * .5, br * .3, br * .14, .6, -.7); Q.restore(); }
        if (state === 'play' && T < 2.6) tag(b0.x, b0.y - br - 34, T < 2 ? 1 : (2.6 - T) / .6);
        if (state === 'play' && (Math.min(...holes.map(h => Math.hypot(bx - h.x, bz - h.z))) < 1.9)) sweat(b0.x + br * .6, b0.y - br * .6, 1.1, T);
        if (state === 'hole') { const hp = new THREE.Vector3(hole.x, .6, hole.z); piv.localToWorld(hp); const hs = X.screen(S, hp); if (fallT > .3) orbitStars(hs.x, hs.y - 20, T, 3, 28); }
        if (state === 'goal') for (let i = 0; i < 5; i++) { const t0 = oT - i * .09; if (t0 > 0) heart(clamp(b0.x, 120, W - 120) - 230 + i * 28, Math.min(b0.y - 40, 130) - t0 * 28, 1, clamp(1.3 - t0 * 1.1, 0, 1)); }
        vignette(.16);
      }
    };
    return g;
    } finally { uuidBack(); }
  }, 'Roll');

  /* ───────────────────────── 4. BASKET ─────────────────────────
     Place: a fruit orchard where it rains fruit (and ladybugs), a flying cow in the sky. Caos holds the basket; his catch piles up inside. */
  reg3('td_basket', sp => {
    const FOGC = 0xa9dfc6;
    const S = T3.scene({ bg: 0x9ad8ff, ground: 0x7ed957, cam: [0, 6, 10.5], look: [0, 2, 0], fov: 62, sun: [4, 14, 6], fog: [28, 60] });
    X.init(); if (X.R) S.scene.background = null;
    const uuidBack = uuidOff();
    try {
    S.scene.fog.color.set(FOGC); S.floor.material = tm(0x7ed957); tone(S);
    const cr = mulberry32(1104);
    const M = mb, need = 5, XR = 4.4;
    for (let i = -6; i <= 6; i++) if (i % 2) flat(S, 2.6, 60, 0x93e46c, i * 2.6, .015, -10);
    /* scenery: SAME rnd() calls and order as before (bush radius, bush jitter) */
    for (const x of [-9, -4.5, 2, 7, 11, -15, -21, 16, 22]) {
      if (Math.abs(x) > 11 * WK + 3) continue; const rad = rnd(1, 1.5), jx = rnd(-1, 1);
      const b = M.sphere(rad, 0x4fbf4f, 1.06); put(S, b, x + jx, 1, -8); const l = M.sphere(rad * .55, 0x6fd86a, 1.0); put(S, l, x + jx - rad * .25, 1.3 + rad * .35, -8 + rad * .6);
      for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(.14, 8, 6), bm(0xff4d5e)); f.position.set(x + jx + (cr() - .5) * rad * 1.4, 1 + (cr() - .2) * rad * .9, -8 + rad * .8); S.scene.add(f); }
    }
    for (const x of [-11, 9.5, -17, 15.5]) {
      if (Math.abs(x) > 11 * WK) continue;
      put(S, M.cyl(.4, .5, 3, 0x8a5a2e), x, 1.5, -6); put(S, M.sphere(2.2, 0x3fae5a, 1.06), x, 4.2, -6); put(S, M.sphere(1.4, 0x55c86e, 1.0), x - .8, 5.0, -4.7);
      for (let k = 0; k < 5; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(.2, 8, 6), bm(k % 2 ? 0xff4d5e : 0xffa62b)); const a = cr() * TAU; f.position.set(x + Math.cos(a) * 2.2, 4.2 + (cr() - .3) * 1.6, -6 + Math.abs(Math.sin(a)) * 2.1 + .1); S.scene.add(f); }
    }
    /* fruit crates at the back (decor) */
    for (const [x, c0] of [[-6.6, 0xffa62b], [6.6, 0x7ed957], [-2.2, 0xe8433a]]) {
      if (Math.abs(x) > 10 * WK) continue;
      const cr2 = M.box(1.9, .9, 1.3, 0xd9944f, 1.06); put(S, cr2, x, .45, -4.6);
      for (let k = 0; k < 5; k++) { const f = M.sphere(.34, c0, 1.1); put(S, f, x - .65 + k * .33, .98 + (k % 2) * .08, -4.6 + (k % 2 ? .25 : -.2)); }
    }
    /* basket + Caos */
    const bk = new THREE.Group();
    const body = M.cyl(1.05, .82, .8, 0xc98a3d); body.position.y = .4; bk.add(body);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(.95, .95, .02, 20), tm(0x4a2e14)); inner.position.y = .8; bk.add(inner);
    const rim = M.torus(1.0, .09, 0x8a5a2e, .06); rim.position.y = .82; bk.add(rim);
    for (const [r, y] of [[.9, .22], [.98, .56]]) { const w = M.torus(r, .05, 0x9b6a30, .04); w.position.y = y; bk.add(w); }
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, w = M.box(.12, .62, .08, 0xb27a36, 1.15); w.position.set(Math.cos(a) * .96, .42, Math.sin(a) * .96); w.rotation.y = -a; bk.add(w); }
    const cl = hero(OR); cl.k = 2.1; cl.scale.setScalar(.78); cl.position.set(0, .45, -1.6); cl.armL.position.set(-1.9, 1.5, 1.2); cl.armR.position.set(1.9, 1.5, 1.2); bk.add(cl);
    const bugHat = (() => { const g = new THREE.Group(); const b = M.sphere(.46, 0xe8433a); b.scale.set(1, .85, 1.15); g.add(b); const h = M.sphere(.26, 0x2b2342); h.position.set(0, 0, .5); g.add(h);
      for (const [x, y, z] of [[-.24, .3, -.1], [.24, .3, -.1], [0, .34, -.35]]) { const d = M.sphere(.1, 0x14101c, 1); d.position.set(x, y, z); g.add(d); }
      for (const s of [-1, 1]) { const e = M.sphere(.1, 0xffffff, 1.12); e.position.set(s * .13, .1, .7); g.add(e); const p = new THREE.Mesh(new THREE.SphereGeometry(.045, 6, 4), bm(0x14101c)); p.position.set(s * .13, .08, .79); g.add(p); } g.visible = false; g.position.set(0, 1.5, -1.6); g.scale.setScalar(.85); return g; })();
    bk.add(bugHat);
    const pile = []; const PILE = [[-.45, 0], [.4, .15], [0, -.45], [-.2, .35], [.35, -.3]];
    T3.add(S, bk, [0, 0, 1]);
    /* shared shadow-disc resources */
    const DG = new THREE.CylinderGeometry(.5, .5, .02, 16);
    const DM = new THREE.MeshBasicMaterial({ color: 0x14101c, transparent: true, opacity: .3 }), DB = new THREE.MeshBasicMaterial({ color: 0x8a0f0f, transparent: true, opacity: .45 });
    const fruitCols = [0x7ed957, 0xffa62b, 0xffe14d, 0xc77dff];
    const mkFruit = (k, s = 1) => {
      const g = new THREE.Group(), b = M.sphere(.42 * s, fruitCols[k], 1.1);
      if (k === 2) b.scale.set(1.25, .9, 1); else if (k === 3) b.scale.set(1, 1.1, 1);
      g.add(b);
      const st = M.cyl(.04 * s, .04 * s, .25 * s, 0x6b3f1d, 1.1); st.position.y = .45 * s; g.add(st);
      const lf = M.box(.22 * s, .04 * s, .12 * s, 0x2f9a3a, 1.1); lf.position.set(.14 * s, .52 * s, 0); lf.rotation.z = .4; g.add(lf);
      const gl = new THREE.Mesh(new THREE.SphereGeometry(.07 * s, 6, 4), bm(0xffffff)); gl.position.set(-.18 * s, .22 * s, .34 * s); g.add(gl);
      return g;
    };
    const mkBug = () => {
      const g = new THREE.Group(), b = M.sphere(.46, 0xe8433a); b.scale.set(1, .85, 1.15); g.add(b);
      const h = M.sphere(.26, 0x2b2342); h.position.set(0, 0, .5); g.add(h);
      for (const [x, y, z] of [[-.24, .3, -.1], [.24, .3, -.1], [0, .34, -.35]]) { const d = M.sphere(.1, 0x14101c, 1); d.position.set(x, y, z); g.add(d); }
      for (const s of [-1, 1]) {
        const e = M.sphere(.1, 0xffffff, 1.12); e.position.set(s * .13, .1, .7); g.add(e);
        const p = new THREE.Mesh(new THREE.SphereGeometry(.045, 6, 4), bm(0x14101c)); p.position.set(s * .13, .08, .79); g.add(p);
        const br = new THREE.Mesh(new THREE.BoxGeometry(.2, .045, .04), bm(0xffffff)); br.position.set(s * .13, .26, .74); br.rotation.z = -s * .5; g.add(br);
        const l = M.box(.5, .05, .05, 0x14101c, 1); l.position.set(s * .5, -.12, 0); l.rotation.z = s * -.4; g.add(l);
      }
      return g;
    };

    const items = [];
    let bx = 0, bz = 1, tx = 0, tz = 1, caught = 0, T = 0, spawnT = .3, nSpawn = 0, sq = 0, cam = 0, vxs = 0, over = false;
    const vBase = 5 + 2 * sp, wp = new THREE.Vector3();
    let oT = 0, popT = 9, happyT = 0, worry = 0;
    const kill = it => { S.scene.remove(it.g); S.scene.remove(it.sh); dispose(it.g); };
    const sc2 = (x, y, z) => { wp.set(x, y, z); return X.screen(S, wp); };
    const SKY = bake(VW, H, () => {
      Q.translate(OX, 0);
      const sg = Q.createLinearGradient(0, 0, 0, 170); sg.addColorStop(0, '#36b0ea'); sg.addColorStop(.55, '#86d8fb'); sg.addColorStop(1, '#d6f7ff'); Q.fillStyle = sg; Q.fillRect(-OX, 0, VW, H);
      const mt = (base, ol, fill, pk, off) => { Q.beginPath(); Q.moveTo(-OX - 20, 175); for (let i = 0; i <= 12; i++) { const x = -OX - 20 + i * (VW + 40) / 12; Q.lineTo(x, base - (i % 2 ? pk : pk * .35) * (.7 + hash(i + off) * .6)); } Q.lineTo(VW, 175); Q.closePath(); Q.lineJoin = 'round'; Q.lineWidth = 5; Q.strokeStyle = ol; Q.stroke(); Q.fillStyle = fill; Q.fill(); };
      mt(150, '#7b80c6', '#c9d0fb', 70, 0); mt(160, '#5b5fa8', '#a4b1f2', 44, 5);
      Q.fillStyle = '#a9dfc6'; Q.beginPath(); Q.moveTo(-OX - 10, 190); for (let i = 0; i <= 8; i++) Q.quadraticCurveTo(-OX + (i + .5) * (VW / 8), 138 + hash(i + 20) * 10, -OX + (i + 1) * (VW / 8), 170); Q.lineTo(VW, 200); Q.lineTo(-OX - 10, 200); Q.fill();
    });
    const cow = (x, y, T) => {
      Q.save(); Q.translate(x, y); const fl = Math.sin(T * 9);
      for (const s of [-1, 1]) { Q.save(); Q.translate(s * 6, -8); Q.rotate(s * (.5 + fl * .5)); Q.beginPath(); Q.ellipse(s * 12, -8, 16, 7, s * -.5, 0, TAU); ink('#fff', 2.5); Q.restore(); }
      rr(-20, -16, 40, 28, 12); ink('#fff', 3); Q.fillStyle = '#14101c'; el(-7, -6, 7, 5); Q.fill(); el(9, 3, 6, 4); Q.fill();
      el(26, -10, 12, 11); ink('#fff', 3); el(30, -6, 8, 5); ink('#ffb6c8', 2); Q.fillStyle = INK; Q.beginPath(); Q.arc(24, -14, 2.2, 0, TAU); Q.fill();
      Q.fillStyle = '#14101c'; rr(15, -30, 10, 10, 3); Q.fill();
      Q.lineWidth = 6; Q.strokeStyle = INK; Q.lineCap = 'round'; for (const lx of [-13, 12]) { Q.beginPath(); Q.moveTo(lx, 10); Q.lineTo(lx + Math.sin(T * 8 + lx) * 3, 20); Q.stroke(); }
      Q.beginPath(); Q.moveTo(-20, -6); Q.quadraticCurveTo(-30, -12, -28, -22); Q.lineWidth = 3; Q.stroke();
      Q.restore();
    };

    const g = {
      wide: true, cmd: 'CATCH!', hint: 'CATCH FRUIT, DODGE BUGS', thint: 'DRAG TO MOVE', dur: 8,
      move(p) { const q = X.ground(S, p, .9); if (q) { tx = clamp(q.x, -XR, XR); tz = clamp(q.z, -1.4, 3.2); } },
      down(p) { g.move(p); },
      update(dt) {
        dt = Math.min(dt, .04); T += dt; sq *= Math.pow(.005, dt); cam *= Math.pow(.02, dt); popT += dt; happyT = Math.max(0, happyT - dt); if (g.result) oT += dt;
        const kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0), kz = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
        if (kx || kz) { tx = clamp(tx + kx * 10 * dt, -XR, XR); tz = clamp(tz + kz * 6 * dt, -1.4, 3.2); }
        const ox = bx; bx += (tx - bx) * Math.min(1, 14 * dt); bz += (tz - bz) * Math.min(1, 14 * dt); vxs += ((bx - ox) / dt - vxs) * Math.min(1, 10 * dt);
        bk.position.set(bx, 0, bz); bk.rotation.z = clamp(-vxs * .02, -.2, .2);
        bk.scale.set(1 + sq * .25, 1 - sq * .2, 1 + sq * .25);
        cl.position.y = .45 + Math.abs(Math.sin(T * 14)) * Math.min(1, Math.abs(vxs) * .2) * .12;
        for (let i = 0; i < 4; i++) cl.legs[i].rotation.x = Math.sin(T * 16 + i) * Math.min(.5, Math.abs(vxs) * .1);
        if (over) { cl.rotation.z = Math.sin(T * 40) * .08; }
        if (!g.result) {
          spawnT -= dt;
          if (spawnT <= 0) {
            const bug = nSpawn >= 2 && Math.random() < .32; nSpawn++;
            const fk = bug ? 0 : Math.floor(Math.random() * 4);
            const fg = bug ? mkBug() : mkFruit(fk), x = rnd(-XR + .2, XR - .2), z = rnd(-1, 2.8), y = 9.5;
            T3.add(S, fg, [x, y, z]);
            const sh = new THREE.Mesh(DG, bug ? DB : DM); sh.position.set(x, .03, z); S.scene.add(sh);
            items.push({ g: fg, sh, bug, k: fk, x, y, z, vy: vBase * rnd(.9, 1.15), spin: rnd(-4, 4) });
            spawnT = (.55 + Math.random() * .3) / Math.sqrt(sp);
          }
        }
        let nearD = 99, nearI = null, bugNear = false;
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i], py = it.y; it.y -= it.vy * dt;
          it.g.position.y = it.y; it.g.rotation.y += it.spin * dt; it.g.rotation.z = Math.sin(T * 5 + it.x) * .2;
          const k = clamp(1 - (it.y - .6) / 9, 0, 1); it.sh.scale.set(.4 + .8 * k, 1, .4 + .8 * k);
          const dd = Math.hypot(it.x - bx, it.z - bz); if (it.y > .6 && it.y < 6 && dd < nearD) { nearD = dd; nearI = it; } if (it.bug && it.y < 5 && it.y > .6 && dd < 2.4) bugNear = true;
          if (!g.result && py > .95 && it.y <= .95 && Math.hypot(it.x - bx, it.z - bz) < 1.1) {
            const s = sc2(it.x, 1.2, it.z);
            if (it.bug) {
              over = true; g.result = 'lose'; sfx.buzz(); sfx.thud(); shake(12, .35); cam = 1; sq = 1;
              burst(s.x, s.y, '#e8433a', 16, 300); ring(s.x, s.y, '#ff5a8a', 110, .45); floatText('BUG!', s.x, s.y - 50, '#ff5a8a', 46);
            } else {
              caught++; sq = 1; sfx.coin(); sfx.blip(caught * 2); sfx.pop(); popT = 0; happyT = .6;
              burst(s.x, s.y, '#FFE14D', 12, 240); ring(s.x, s.y, '#fff', 70, .35); floatText('+1', s.x, s.y - 40, '#FFE14D', 36);
              const pf = mkFruit(it.k, .62); const pp = PILE[(caught - 1) % 5]; pf.position.set(pp[0], .88, pp[1]); pf.userData.pile = caught - 1; bk.add(pf); pile.push(pf);
              if (caught >= need) { g.result = 'win'; sfx.sparkle(); confetti(W / 2, H / 2, 50); cam = .5; }
            }
            kill(it); items.splice(i, 1); continue;
          }
          if (it.y <= .4) {
            if (!it.bug) { const s = sc2(it.x, .3, it.z); burst(s.x, s.y, '#fff', 5, 120); sfx.tick(); } else sfx.tick();
            kill(it); items.splice(i, 1);
          }
        }
        /* art: Caos looks at the nearest falling thing, worries about bugs, juggles on a win, turns green on a loss */
        const lx = nearI ? (nearI.x - bx) * .25 : 0, ly = nearI ? clamp((nearI.y - 3) * .2, -1, 1) : 0;
        const mood = g.result === 'win' ? 'happy' : g.result === 'lose' ? 'sick' : happyT > 0 ? 'happy' : bugNear ? 'panic' : nearI && nearD < 2.8 ? 'eager' : 'idle';
        cl.mood(mood, clamp(lx, -1, 1), ly, T); cl.tint(g.result === 'lose' ? 0x9ad45a : OR);
        cl.armL.rotation.z = mood === 'happy' ? Math.sin(T * 18) * .3 + .5 : 0; cl.armR.rotation.z = -cl.armL.rotation.z;
        bugHat.visible = g.result === 'lose'; if (bugHat.visible) { bugHat.rotation.y = Math.sin(T * 10) * .4; bugHat.position.y = 1.5 + Math.abs(Math.sin(T * 12)) * .12; }
        if (g.result === 'win') {
          cl.position.y = .45 + Math.abs(Math.sin(oT * 9)) * .35;
          pile.forEach((f, i) => { const k = outBack((oT - i * .03) / .3), a = T * 5 + i * TAU / 5; f.position.set(Math.cos(a) * 1.5 * k, .88 + k * (2.5 + Math.sin(a * 1.3) * .35), -1.6 + Math.sin(a) * .6 * k); f.rotation.y = a; });
        }
        if (g.result === 'lose') pile.forEach((f, i) => { const k = clamp((oT - .1) / .5, 0, 1); f.position.x += (i % 2 ? 1 : -1) * dt * 2 * k; f.position.y = Math.max(.15 - .5, f.position.y - dt * 4 * k); f.visible = f.position.y > -.3; });
        const c = S.camera; c.position.set(bx * .12 + (Math.random() - .5) * cam * .3, 6 + (Math.random() - .5) * cam * .3, 10.5); c.lookAt(bx * .06, 2, 0);
      },
      draw() {
        Q = ctx; ctx.drawImage(SKY, -OX, 0);
        sunDisc(612, 118, T);
        for (const [x0, y0, sp0, s0] of [[40, 128, 6, 1.0], [300, 96, 9, .8], [520, 142, 7, 1.15], [700, 110, 5, .7]]) cloud(((x0 + T * sp0 + OX) % (VW + 220)) - 160 - OX, y0, s0);
        cow(((T * 70 + 120 + OX) % (VW + 400)) - 200 - OX, 104 + Math.sin(T * 2.4) * 8, T);
        slotsHud(caught, need, popT, fruitIcon);   /* under the 3D layer: falling fruit passes in front of the plank */
        X.render(S);
        const hp = scr(S, bx, 2.1, bz - 1.6);
        if (!g.result && T < 2.5) tag(hp.x, hp.y - 18, T < 1.9 ? 1 : (2.5 - T) / .6);
        if (!g.result && worry >= 0) { /* sweat when a bug is close is handled by the mood; draw the drop too */ }
        if (g.result === 'lose') { for (let i = 0; i < 3; i++) { const k = (oT * 1.2 + i / 3) % 1; Q.save(); Q.globalAlpha = Math.sin(k * Math.PI); Q.strokeStyle = '#7fd34a'; Q.lineWidth = 4; Q.lineCap = 'round'; Q.beginPath(); const sx0 = hp.x - 40 + i * 40; Q.moveTo(sx0, hp.y - 4 - k * 36); Q.bezierCurveTo(sx0 + 8, hp.y - 14 - k * 36, sx0 - 8, hp.y - 24 - k * 36, sx0, hp.y - 34 - k * 36); Q.stroke(); Q.restore(); } orbitStars(hp.x, hp.y - 10, T, 3, 32); }
        if (g.result === 'win') {
          for (let i = 0; i < 5; i++) { const t0 = oT - i * .09; if (t0 > 0) heart(hp.x + (i - 2) * 30, hp.y - 30 - t0 * 80, 1.05, clamp(1.3 - t0 * 1.4, 0, 1)); }
          rainIcons(oT, 16, (i, x, y) => fruitIcon(i, x, y, 1.7));
        }
        if (g.result === 'lose') for (let i = 0; i < 8; i++) { const dir = i % 2 ? -1 : 1, t0 = oT * 300 + hash(i + 40) * 90, x = dir > 0 ? -OX - 30 + t0 : W + OX + 30 - t0, y = 470 + (i % 4) * 16; bugIcon(x, y, 1.1, dir, T + i); }
        vignette(.14);
      }
    };
    return g;
    } finally { uuidBack(); }
  }, 'Catch');
})();
