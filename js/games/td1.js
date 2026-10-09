'use strict';
/* 3D wave 1: td_stack, td_bowl, td_dive, td_hoop. Everything lives in an IIFE so helper names never leak into the shared global scope.
   DUO art look (docs/ART-STYLE.md): toon (3-step cel) materials + inked back-face hulls, a specific absurd place per game, Caos and
   the props have canvas faces that react, drawn win / lose payoffs, HUD as a wooden plaque in the world. Decor randomness uses its own
   mulberry32 (never Math.random) so the game's seeded setup and RNG order are untouched. */
(() => {
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, k) => a + (b - a) * k;
  const outBack = k => { const c = 1.70158; k = cl(k, 0, 1) - 1; return 1 + (c + 1) * k * k * k + c * k * k; };
  /* widescreen: world point → game px (x may be <0 / >W); the wide renderer lives in td3.js (_td3.render) */
  const scr = (S, v) => { const q = v.clone().project(S.camera); return { x: (q.x + 1) / 2 * VW - OX, y: (1 - q.y) / 2 * H, z: q.z }; };

  /* ───────────── 2D kit (draws on X so it can bake offscreen) ───────────── */
  let X = null;
  const rr = (x, y, w, h, r) => { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); };
  const ink = (fill, o) => { X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); if (fill) { X.fillStyle = fill; X.fill(); } };
  const mkc = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const o = X; X = c.getContext('2d'); try { fn(); } finally { X = o; } return c; };
  const PLQ = {};
  const plaqueBase = w => PLQ[w] || (PLQ[w] = mkc(w + 24, 72, () => {            // wooden sign: shadow, depth, face, grain, gloss (baked once per width)
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(16, 16, w, 44, 14); X.fill();
    rr(12, 16, w, 44, 14); ink('#a5622c', 4);
    rr(12, 7, w, 44, 14); ink('#d9944f', 4);
    X.strokeStyle = '#c98443'; X.lineWidth = 2.5; X.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const gy = 17 + i * 9; X.beginPath(); X.moveTo(24 + i * 9, gy); X.lineTo(w - 14 - i * 5, gy); X.stroke(); }
    X.fillStyle = 'rgba(255,255,255,.3)'; rr(22, 11, w - 20, 7, 3.5); X.fill();
  }));
  /* progress plaque hung at the top centre (below the hint line). icon(x, y, on, i, k) draws one pip, k = pop scale of the newest */
  const plaque = (n, need, slot, icon, popAt, now_, px0, py0) => {
    const w = 78 + need * slot, cx = px0 == null ? W / 2 : px0, y = py0 == null ? 62 : py0;
    X.drawImage(plaqueBase(w), cx - w / 2 - 12, y - 7);
    txt(n + '/' + need, cx - w / 2 + 38, y + 24, 24, '#fff');
    for (let i = 0; i < need; i++) {
      const px = cx - w / 2 + 76 + slot / 2 + i * slot, on = i < n, k = on && i === n - 1 ? 1 + .35 * Math.max(0, 1 - (now_ - popAt) * 4) * outBack(Math.min(1, (now_ - popAt) * 6)) : 1;
      X.save(); X.translate(px, y + 24); X.scale(k, k); icon(0, 0, on, i); X.restore();
    }
  };
  const badge = (s, x, y, size, bg, fg, rot = 0) => {                              // shouted word on a slab with a gloss
    X.save(); X.translate(x, y); X.rotate(rot);
    X.font = '900 ' + size + 'px "Arial Black", Impact, sans-serif'; const w = Math.min(420, X.measureText(t(s)).width) + 40, h = size * 1.2;
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, h * .3); X.fill();
    rr(-w / 2, -h / 2, w, h, h * .3); ink(bg, 4);
    X.fillStyle = 'rgba(255,255,255,.35)'; rr(-w / 2 + 8, -h / 2 + 5, w - 16, h * .22, 5); X.fill();
    X.restore(); txt(s, x, y + 2, size, fg, 'center', 400);
  };
  const heart = (x, y, s, col) => { X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-16, -4, -9, -16, 0, -8); X.bezierCurveTo(9, -16, 16, -4, 0, 8); X.closePath(); ink(col, 3 / s); X.restore(); };
  const spark = (x, y, r, col) => { X.save(); X.translate(x, y); X.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, q = i % 2 ? r * .4 : r; X.lineTo(Math.cos(a) * q, Math.sin(a) * q); } X.closePath(); ink(col, 2.5); X.restore(); };
  /* chunky vertical meter (BOWL / HOOP power): pw 0..1, optional sweet zone [lo, hi] */
  const meter = (bx, by, bw, bh, pw, sweet) => {
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(bx + 4, by + 7, bw, bh, 14); X.fill();
    rr(bx, by, bw, bh, 14); ink('#fff6e6', 4);
    X.save(); rr(bx + 3, by + 3, bw - 6, bh - 6, 11); X.clip();
    const bands = 5; for (let i = 0; i < bands; i++) { X.fillStyle = i % 2 ? '#efe2c8' : '#fff6e6'; X.fillRect(bx, by + bh * i / bands, bw, bh / bands); }
    if (sweet) { X.fillStyle = '#5CFF7A'; X.fillRect(bx, by + bh * (1 - sweet[1]), bw, bh * (sweet[1] - sweet[0])); X.fillStyle = '#23a046'; X.fillRect(bx, by + bh * (1 - sweet[1]) + 3, bw, 3); }
    if (pw >= 0) { const fh = bh * pw; X.fillStyle = pw > .85 && !sweet ? '#ff4d5e' : '#ffd23f'; X.fillRect(bx, by + bh - fh, bw, fh); X.fillStyle = 'rgba(255,255,255,.35)'; X.fillRect(bx + 4, by + bh - fh, 6, fh); }
    X.restore();
    if (pw >= 0) { const y = by + bh * (1 - pw); X.beginPath(); X.moveTo(bx - 14, y - 11); X.lineTo(bx + 2, y); X.lineTo(bx - 14, y + 11); X.closePath(); ink('#ff4d5e', 3); X.beginPath(); X.moveTo(bx + bw + 14, y - 11); X.lineTo(bx + bw - 2, y); X.lineTo(bx + bw + 14, y + 11); X.closePath(); ink('#ff4d5e', 3); }
  };

  /* ───────────── 3D kit: toon materials, inked hulls, faces ───────────── */
  let GMAP = null, INKM = null;
  const gmap = () => GMAP || (GMAP = (() => { const d = new THREE.DataTexture(new Uint8Array([150, 212, 255]), 3, 1, THREE.LuminanceFormat); d.minFilter = d.magFilter = THREE.NearestFilter; d.generateMipmaps = false; d.needsUpdate = true; return d; })());
  const tm = (c, map) => new THREE.MeshToonMaterial({ color: c, gradientMap: gmap(), map: map || null });
  const bm = (c, o) => new THREE.MeshBasicMaterial(Object.assign({ color: c }, o || {}));
  const inkm = () => INKM || (INKM = new THREE.MeshBasicMaterial({ color: 0x14101c, side: THREE.BackSide }));
  const fin = (m, hg) => { m.castShadow = m.receiveShadow = true; if (hg) { const o = new THREE.Mesh(hg, inkm()); o.userData.outline = true; m.add(o); } return m; };
  const mbox = (w, h, d, c, e = .07, map) => fin(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), tm(c, map)), e > 0 ? new THREE.BoxGeometry(w + 2 * e, h + 2 * e, d + 2 * e) : null);
  const msph = (r, c, e = .06) => fin(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), tm(c)), e > 0 ? new THREE.SphereGeometry(r + e, 20, 14) : null);
  const mcyl = (rt, rb, h, c, e = .05, seg = 18) => fin(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), tm(c)), e > 0 ? new THREE.CylinderGeometry(rt + e, rb + e, h + 2 * e, seg) : null);
  const mcone = (r, h, c, e = .05, seg = 14) => fin(new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), tm(c)), e > 0 ? new THREE.ConeGeometry(r + e, h + 2 * e, seg) : null);
  const mtor = (r, tube, c, e = .04) => fin(new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 24), tm(c)), e > 0 ? new THREE.TorusGeometry(r, tube + e, 10, 24) : null);
  const flat = (geo, c, o) => new THREE.Mesh(geo, bm(c, o));
  const at = (S, m, p, r) => { if (p) m.position.set(p[0], p[1], p[2]); if (r) m.rotation.set(r[0], r[1], r[2]); (S.scene || S).add(m); return m; };
  const kill = m => { m.traverse(o => { if (o.geometry) o.geometry.dispose(); }); if (m.parent) m.parent.remove(m); };
  const SKY = {};
  const skyBg = (S, key, stops, fog) => {                                          // gradient sky as the scene background (one cached texture per key)
    let t = SKY[key];
    if (!t) { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 256); stops.forEach(s => gr.addColorStop(s[0], s[1])); x.fillStyle = gr; x.fillRect(0, 0, 4, 256); t = SKY[key] = new THREE.CanvasTexture(c); }
    S.scene.background = t; if (fog != null && S.scene.fog) S.scene.fog.color.setHex(fog);
  };
  const tune = (S, hemi, sun) => S.scene.traverse(o => { if (o.isHemisphereLight) o.intensity = hemi; else if (o.isDirectionalLight) o.intensity = sun; });
  const toonFloor = (S, c, map) => { S.floor.material.dispose(); S.floor.material = tm(c, map); };
  const puff = (k = 1, e = .08) => { const c = new THREE.Group(); [[0, 0, 0, 1.6], [1.5, -.2, .2, 1.2], [-1.4, -.1, -.2, 1.3]].forEach(q => { const s = msph(q[3] * k, 0xffffff, e); s.position.set(q[0] * k, q[1] * k, q[2] * k); s.castShadow = false; c.add(s); }); return c; };

  /* faces: canvas textures on a plane in front of the mesh. Cached by mood so a swap is just `material.map = tex` */
  const FT = {}, INKC = '#14101c';
  const faceTex = (mood, look = 0, blink = 0, gog = 0) => {
    const key = mood + '|' + look + '|' + blink + '|' + gog;
    if (FT[key]) return FT[key];
    const c = document.createElement('canvas'); c.width = 256; c.height = 144; const x = c.getContext('2d');
    x.lineCap = x.lineJoin = 'round';
    const ex = [74, 182], ey = 60, st = (w, col) => { x.lineWidth = w; x.strokeStyle = col || INKC; };
    const eye = (cx, sx, sy, pr, dx, dy) => {
      x.beginPath(); x.ellipse(cx, ey, sx, sy, 0, 0, 7); x.fillStyle = '#fff'; x.fill(); st(6); x.stroke();
      x.beginPath(); x.arc(cx + dx, ey + dy, pr, 0, 7); x.fillStyle = INKC; x.fill();
      x.beginPath(); x.arc(cx + dx - pr * .35, ey + dy - pr * .4, pr * .35, 0, 7); x.fillStyle = '#fff'; x.fill();
    };
    const brow = (x1, y1, x2, y2) => { st(8); x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke(); };
    const drop = (px, py, s) => { x.beginPath(); x.moveTo(px, py - 12 * s); x.quadraticCurveTo(px + 11 * s, py + 2 * s, px, py + 10 * s); x.quadraticCurveTo(px - 11 * s, py + 2 * s, px, py - 12 * s); x.fillStyle = '#9fe3ff'; x.fill(); st(4); x.stroke(); };
    x.fillStyle = mood === 'happy' ? 'rgba(255,90,150,.8)' : 'rgba(255,110,165,.55)';
    for (const bx of [38, 218]) { x.beginPath(); x.ellipse(bx, 100, 17, 10, 0, 0, 7); x.fill(); }
    if (mood === 'idle' || mood === 'eager') {
      for (const cx of ex) { if (blink) { st(8); x.beginPath(); x.moveTo(cx - 20, ey + 2); x.lineTo(cx + 20, ey + 2); x.stroke(); } else eye(cx, 22, 27, 12, look * 8, 2); }
      st(7); x.beginPath(); x.arc(128, mood === 'eager' ? 86 : 94, mood === 'eager' ? 26 : 18, .12 * Math.PI, .88 * Math.PI); x.stroke();
    } else if (mood === 'worried') {
      for (const cx of ex) eye(cx, 27, 32, 7, look * 7, 4);
      brow(ex[0] - 26, ey - 40, ex[0] + 18, ey - 54); brow(ex[1] - 18, ey - 54, ex[1] + 26, ey - 40);
      st(7); x.beginPath(); x.moveTo(98, 108); for (let i = 1; i <= 6; i++) x.lineTo(98 + i * 10, 108 + (i % 2 ? -7 : 5)); x.stroke(); drop(232, 34, 1.1);
    } else if (mood === 'panic') {
      for (const cx of ex) eye(cx, 31, 36, 5, 0, 0);
      brow(ex[0] - 26, ey - 46, ex[0] + 18, ey - 58); brow(ex[1] - 18, ey - 58, ex[1] + 26, ey - 46);
      x.beginPath(); x.ellipse(128, 106, 20, 17, 0, 0, 7); x.fillStyle = INKC; x.fill(); x.beginPath(); x.ellipse(128, 113, 12, 7, 0, 0, 7); x.fillStyle = '#ff5c8a'; x.fill(); drop(236, 30, 1.2); drop(20, 40, .9);
    } else if (mood === 'happy') {
      st(10); for (const cx of ex) { x.beginPath(); x.arc(cx, ey + 12, 22, 1.15 * Math.PI, 1.85 * Math.PI); x.stroke(); }
      x.beginPath(); x.moveTo(94, 88); x.quadraticCurveTo(128, 138, 162, 88); x.closePath(); x.fillStyle = INKC; x.fill(); st(5); x.stroke();
      x.beginPath(); x.ellipse(128, 106, 16, 9, 0, 0, Math.PI); x.fillStyle = '#ff5c8a'; x.fill();
    } else if (mood === 'sad') {
      st(9); for (const cx of ex) { x.beginPath(); x.arc(cx, ey - 6, 21, .15 * Math.PI, .85 * Math.PI); x.stroke(); }
      for (const cx of ex) { x.beginPath(); x.moveTo(cx - 6, ey + 22); x.lineTo(cx - 12, ey + 70); x.lineTo(cx + 2, ey + 70); x.closePath(); x.fillStyle = '#9fe3ff'; x.fill(); }
      st(7); x.beginPath(); x.arc(128, 122, 20, 1.15 * Math.PI, 1.85 * Math.PI); x.stroke();
    } else if (mood === 'dizzy') {
      st(8); for (const cx of ex) { x.beginPath(); x.moveTo(cx - 17, ey - 17); x.lineTo(cx + 17, ey + 17); x.moveTo(cx + 17, ey - 17); x.lineTo(cx - 17, ey + 17); x.stroke(); }
      st(7); x.beginPath(); x.moveTo(98, 104); for (let i = 1; i <= 6; i++) x.lineTo(98 + i * 10, 104 + (i % 2 ? -7 : 5)); x.stroke();
    }
    if (gog) {                                                                     // aviator goggles: lens + ring over each eye and a strap
      st(7); x.beginPath(); x.moveTo(0, ey - 8); x.lineTo(ex[0] - 40, ey - 4); x.moveTo(256, ey - 8); x.lineTo(ex[1] + 40, ey - 4); x.stroke();
      for (const cx of ex) { x.beginPath(); x.ellipse(cx, ey, 38, 38, 0, 0, 7); x.fillStyle = 'rgba(130,205,255,.38)'; x.fill(); st(10); x.stroke(); x.beginPath(); x.arc(cx - 14, ey - 16, 7, 0, 7); x.fillStyle = 'rgba(255,255,255,.7)'; x.fill(); }
      st(9); x.beginPath(); x.moveTo(ex[0] + 36, ey); x.lineTo(ex[1] - 36, ey); x.stroke();
    }
    return FT[key] = new THREE.CanvasTexture(c);
  };
  /* 3D Caos with a canvas face. Same layout and fields as T3.caos (legs[4], armL, armR) plus .face(mood, look, t, k) */
  const caos3 = (S, s = 1, c = OR, pos, gog = 0) => {
    const g = new THREE.Group();
    const body = mbox(3, 1.75, 1.8, c, .1); body.position.y = 1.65; g.add(body);
    const armL = mbox(.5, .6, .6, c, .08); armL.position.set(-1.75, 1.45, 0); g.add(armL);
    const armR = mbox(.5, .6, .6, c, .08); armR.position.set(1.75, 1.45, 0); g.add(armR);
    g.legs = [-1.25, -.65, .35, .95].map(x => { const l = mbox(.3, .8, .4, c, .07); l.position.set(x + .15, .4, 0); g.add(l); return l; });
    const fm = new THREE.MeshBasicMaterial({ map: faceTex('idle', 0, 0, gog), transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const fp = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.52), fm); fp.position.set(0, 1.62, .912); g.add(fp);
    g.fuse = T3.fuse(g, 2.52);
    g.eyes = []; g.armL = armL; g.armR = armR; g.body = body; g.scale.setScalar(s);
    g.face = (mood, look = 0, t = 0, k = 0) => { const bl = (mood === 'idle' || mood === 'eager') && Math.sin(t * 1.9 + k) > .985 ? 1 : 0; const tx = faceTex(mood, look, bl, gog); if (fm.map !== tx) fm.map = tx; };
    if (S) { (S.scene || S).add(g); if (pos) g.position.set(pos[0], pos[1], pos[2]); }
    return g;
  };
  /* toon shadow-blob helper for things standing on a floor */
  const blob = (S, x, y, z, r) => { const m = flat(new THREE.CircleGeometry(r, 20), 0x14101c, { transparent: true, opacity: .22, depthWrite: false }); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); (S.scene || S).add(m); return m; };

  /* ───────────── 1. STACK ───────────── */
  /* Place: a floating cargo barge in a sunny harbour. Spectator Caos on a raft, a rubber duck that stares at you (and turns its back when you fail),
     lighthouse, sun, buoys and sea foam. Win: Caos plants a flag on top. Lose: the slab drops in the sea, the tower wobbles. */
  reg3('td_stack', sp => {
    const NEED = 4 + (sp > 1.35 ? 1 : 0) + (sp > 1.75 ? 1 : 0), CH = .6, AMP = 4.2;
    const PAL = [0xff7755, 0xffc93c, 0x5fd38d, 0x4fb3ff, 0xb98cff, 0xff8ac2];
    const PALC = ['#ff7755', '#ffc93c', '#5fd38d', '#4fb3ff', '#b98cff', '#ff8ac2'];
    const S = T3.scene({ bg: 0xd6f7ff, fog: [30, 85], cam: [7, 5, 9], look: [0, 1.5, 0], ground: 0x37b3e6, sun: [6, 14, 8] });
    tune(S, .95, .6);
    skyBg(S, 'harbor', [[0, '#36b0ea'], [.09, '#86d8fb'], [.155, '#d6f7ff'], [1, '#d6f7ff']], 0xd6f7ff);
    toonFloor(S, 0x2f9fe3); S.floor.position.y = -1.3;
    const cr = mulberry32(1101);
    const TW = new THREE.Group(); S.scene.add(TW); const TS = { scene: TW };      // the tower lives in a group so it can wobble on a loss
    /* barge + pallet */
    at(S, mbox(5.4, 1.2, 5.4, 0xd9573f, .1), [0, -.72, 0]);
    at(S, mbox(5.5, .22, .5, 0xffffff, 0), [0, -.5, 2.72]); at(S, mbox(5.5, .22, .5, 0xffffff, 0), [0, -.5, -2.72]);
    for (const [bx, bz] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) at(S, mcyl(.22, .26, .35, 0x3b3550, .05), [bx, -.02, bz]);   // bollards
    at(S, mbox(4, .3, 4, 0xe3b56e, .07), [0, -.1, 0]);
    for (const dz of [-1.3, 0, 1.3]) at(S, mbox(4.02, .08, .5, 0xb98042, 0), [0, -.1, dz]);
    const foams = [0, 1, 2].map(i => { const f = flat(new THREE.TorusGeometry(3.9, .09, 6, 40), 0xffffff, { transparent: true, opacity: 0, depthWrite: false }); f.rotation.x = Math.PI / 2; f.position.y = -1.27; S.scene.add(f); return f; });
    const dashes = []; for (let i = 0; i < 26; i++) { const d = flat(new THREE.BoxGeometry(.9 + cr() * .8, .03, .1), 0xffffff, { transparent: true, opacity: .8 }); d.position.set(cr() * 40 - 20, -1.27, cr() * 36 - 22); S.scene.add(d); dashes.push({ m: d, x: d.position.x, z: d.position.z, ph: cr() * 6 }); }
    /* sky layer (follows the camera height so the sun / clouds stay put on screen) */
    const SKG = new THREE.Group(); S.scene.add(SKG);
    const sun = flat(new THREE.SphereGeometry(4, 20, 14), 0xffe14d, { fog: false }); sun.position.set(-30, 5, -62); SKG.add(sun);
    const halo = flat(new THREE.SphereGeometry(6.4, 20, 14), 0xfff3a0, { fog: false, transparent: true, opacity: .45 }); halo.position.copy(sun.position); SKG.add(halo);
    const clouds = [[-24, 17, -50, 1.3], [8, 21, -56, 1.6], [26, 14, -46, 1.2], [-6, 25, -60, 1.7]].map(q => { const c = puff(q[3], .1); c.position.set(q[0], q[1], q[2]); SKG.add(c); return c; });
    /* far layer: lighthouse + sailboat (no ink, they fade into the haze) */
    const lh = new THREE.Group(); const lhc = [0xff5a5a, 0xffffff, 0xff5a5a, 0xffffff];
    lhc.forEach((c, i) => { const m = mcyl(2.2 - i * .28, 2.5 - i * .28, 2.6, c, 0); m.position.y = 1.3 + i * 2.6; lh.add(m); });
    const lamp = flat(new THREE.SphereGeometry(1.5, 14, 10), 0xffe14d, { fog: false }); lamp.position.y = 11.4; lh.add(lamp);
    const roof = mcone(1.9, 1.8, 0x3b3550, 0); roof.position.y = 13; lh.add(roof); lh.position.set(-5, -1.3, -46); lh.scale.setScalar(.55); S.scene.add(lh);
    const boat = new THREE.Group(); const hull = mbox(5, 1, 1.8, 0xffffff, 0); boat.add(hull); const mast = mbox(.15, 5, .15, 0x8a5a34, 0); mast.position.y = 3; boat.add(mast);
    const sail = mbox(.1, 4, 2.6, 0xffc93c, 0); sail.position.set(0, 3.2, .1); boat.add(sail); boat.position.set(14, -.8, -32); S.scene.add(boat);
    /* buoys */
    const buoys = [[4.5, 6.2], [-6.5, -3.5], [7.5, -2.5], [-3, 8]].map(q => { const b = new THREE.Group(); const bs = mcyl(.4, .5, .55, 0xff4d5e, .05); bs.position.y = .2; b.add(bs); const b2 = mcyl(.42, .42, .16, 0xffffff, 0); b2.position.y = .22; b.add(b2); const bt = msph(.3, 0xffe14d, .04); bt.position.y = .85; b.add(bt); b.position.set(q[0], -1.2, q[1]); S.scene.add(b); return b; });
    /* rubber duck (stares at the camera) */
    const duck = new THREE.Group(); const dbody = msph(.8, 0xffe14d, .06); dbody.scale.set(1.2, .85, 1); dbody.position.y = .3; duck.add(dbody);
    const dhead = msph(.5, 0xffe14d, .06); dhead.position.set(0, 1.05, .45); duck.add(dhead);
    const dbeak = mbox(.55, .16, .4, 0xff8a2b, .04); dbeak.position.set(0, .98, 1.0); duck.add(dbeak);
    for (const sx of [-1, 1]) { const w = msph(.2, 0xffffff, .04); w.position.set(sx * .2, 1.2, .8); w.scale.set(1, 1.2, .5); duck.add(w); const pu = flat(new THREE.SphereGeometry(.09, 8, 6), 0x14101c); pu.position.set(sx * .2, 1.2, .93); duck.add(pu); const wg = msph(.4, 0xffd23f, .05); wg.scale.set(.35, .6, .9); wg.position.set(sx * .95, .4, -.05); duck.add(wg); }
    duck.position.set(4.6, -1.3, -2.2); S.scene.add(duck);
    /* spectator Caos on a raft */
    const raft = mbox(2.6, .3, 2.6, 0xd9944f, .07); raft.position.set(-5.2, -1.2, 3); S.scene.add(raft);
    for (const dz of [-.7, .7]) at(S, mbox(2.64, .1, .5, 0xb06d33, 0), [-5.2, -1.2, 3 + dz]);
    const SY = -1.05, spec = caos3(S, .5, OR, [-5.2, SY, 3]); spec.rotation.y = .7;
    const fall = [], top = { x: 0, z: 0, w: 3, d: 3 };
    at(TS, mbox(3, CH, 3, PAL[0], .07), [0, CH / 2, 0]);
    let placed = 0, ph = -Math.PI / 2, camY = 0, t0 = .35, cur = null, bounce = 0, popAt = -9, rT0 = -1, tt = 0, flag = null, wob = 0, loseAt = -1;
    const axisX = () => (placed % 2) === 0;
    const spawn = () => {
      const x = axisX();
      cur = at(TS, mbox(top.w, CH, top.d, PAL[(placed + 1) % PAL.length], .07), [x ? 0 : top.x, CH / 2 + (placed + 1) * CH, x ? top.z : 0]);
      ph = -Math.PI / 2;
    };
    spawn();
    const addFall = (m, vx, vz) => { fall.push({ m, vy: 0, vx, vz, rx: rnd(-2, 2), rz: rnd(-2, 2), sp: 0 }); };
    const chunk = (w, d, x, y, z, c, vx, vz) => { addFall(at(TS, mbox(w, CH, d, c, .07), [x, y, z]), vx, vz); };
    const drop = () => {
      if (g.result || t0 > 0 || !cur) return;
      const x = axisX(), a = AMP * Math.sin(ph), c = x ? top.x : top.z, s = x ? top.w : top.d;
      const lo = Math.max(a - s / 2, c - s / 2), hi = Math.min(a + s / 2, c + s / 2), ov = hi - lo, y = cur.position.y;
      const col = PAL[(placed + 1) % PAL.length];
      if (ov < .08) {                                                 // total miss
        addFall(cur, 0, 0); cur.position.set(x ? a : top.x, y, x ? top.z : a);
        sfx.miss(); sfx.buzz(); shake(8, .3); g.result = 'lose';
        const q = scr(S, cur.position); floatText('MISS!', q.x, q.y, '#ff5a5a', 44); return;
      }
      const perfect = Math.abs(a - c) < .13;
      let nc = (lo + hi) / 2, ns = ov;
      if (perfect) { nc = c; ns = s; } else {
        const cut = s - ov, side = a > c ? 1 : -1;
        const cx = a > c ? hi + cut / 2 : lo - cut / 2;
        chunk(x ? cut : top.w, x ? top.d : cut, x ? cx : top.x, y, x ? top.z : cx, col, x ? side * 2 : 0, x ? 0 : side * 2);
      }
      kill(cur);
      const w = x ? ns : top.w, d = x ? top.d : ns, px = x ? nc : top.x, pz = x ? top.z : nc;
      cur = at(TS, mbox(w, CH, d, col, .07), [px, y, pz]);
      top.x = px; top.z = pz; top.w = w; top.d = d; placed++; bounce = .12; popAt = tt;
      const q = scr(S, cur.position);
      if (perfect) { sfx.sparkle(); sfx.coin(); ring(q.x, q.y, '#FFE14D', 110); burst(q.x, q.y, '#FFE14D', 16); floatText('PERFECT!', q.x, q.y - 40, '#FFE14D', 40); spec.position.y = SY + .6; }
      else { sfx.thud(); sfx.hit(); burst(q.x, q.y, '#fff', 8, 160); shake(3, .12); }
      if (placed >= NEED) {
        g.result = 'win'; sfx.sparkle(); ring(q.x, q.y, '#fff', 140); burst(q.x, q.y - 20, '#FFE14D', 22);
        const h = caos3(TS, .35, OR, [px, y + CH / 2, pz]); h.armL.position.y = 2; h.armR.position.y = 2; cur.userData.h = h;
        const fl = new THREE.Group(); const pole = mcyl(.04, .04, 1.5, 0xf4f4f4, .03, 8); pole.position.y = .75; fl.add(pole);
        const pen = mbox(.7, .42, .05, 0xff4d5e, .04); pen.position.set(.4, 1.3, 0); fl.add(pen); fl.position.set(px + (w / 2 - .25), y + CH / 2, pz + (d / 2 - .25)); TS.scene.add(fl); flag = { g: fl, pen };
      } else spawn();
    };
    const g = {
      wide: true, cmd: 'STACK!', hint: 'CLICK / SPACE TO DROP', thint: 'TAP TO DROP', dur: 7,
      update(dt, t) {
        tt = t; if (g.result && rT0 < 0) { rT0 = t; if (g.result === 'lose') loseAt = t; }
        if (t0 > 0) t0 -= dt;
        if (!g.result && cur) {
          ph += dt * (2.1 + .28 * placed) * (.9 + .35 * (sp - 1));
          const a = AMP * Math.sin(ph);
          if (axisX()) cur.position.x = a; else cur.position.z = a;
        }
        for (let i = fall.length - 1; i >= 0; i--) {
          const f = fall[i]; f.vy -= 26 * dt; f.m.position.y += f.vy * dt; f.m.position.x += f.vx * dt; f.m.position.z += f.vz * dt;
          f.m.rotation.x += f.rx * dt; f.m.rotation.z += f.rz * dt;
          const fx = f.m.position.x, fz = f.m.position.z;
          if (!f.sp && f.m.position.y < -1.2) { f.sp = 1; const q = scr(S, f.m.position); sfx.thud(); ring(q.x, q.y, '#9fe3ff', 90, .45); burst(q.x, q.y, '#9fe3ff', 10, 220); }
          if (!f.sp && f.m.position.y < .15 && Math.abs(fx) < 2.7 && Math.abs(fz) < 2.7) { f.sp = 1; f.m.visible = false; const q = scr(S, f.m.position); burst(q.x, q.y, '#fff', 6, 120); }
          if (f.m.position.y < -9) { kill(f.m); fall.splice(i, 1); }
        }
        bounce = Math.max(0, bounce - dt);
        const ty = CH * placed; camY += (ty - camY) * Math.min(1, dt * 4);
        S.camera.position.set(7, camY + 5 + bounce * .4, 9); S.camera.lookAt(0, camY + 1.3, 0);
        /* live decor */
        SKG.position.y = camY; clouds.forEach((c, i) => { c.position.x = ((c.position.x + 40 + dt * (1.2 + i * .35)) % 90) - 40 - (i % 2 ? 0 : 0); });
        halo.scale.setScalar(1 + Math.sin(t * 1.5) * .05);
        lamp.material.color.setHex(Math.sin(t * 3) > 0 ? 0xffe14d : 0xffb347);
        boat.position.x = 14 - ((t * .5) % 1) * 0; boat.rotation.z = Math.sin(t * 1.1) * .05; boat.position.y = -.8 + Math.sin(t * 1.3) * .08;
        buoys.forEach((b, i) => { b.position.y = -1.2 + Math.sin(t * 1.6 + i * 1.7) * .08; b.rotation.z = Math.sin(t * 1.3 + i) * .12; });
        foams.forEach((f, i) => { const k = ((t * .45 + i / 3) % 1); f.scale.setScalar(1 + k * .5); f.material.opacity = (1 - k) * .75; });
        dashes.forEach(d => { d.m.position.x = d.x + Math.sin(t * .6 + d.ph) * .5; d.m.material.opacity = .45 + Math.sin(t * 1.4 + d.ph) * .35; });
        raft.position.y = -1.2 + Math.sin(t * 1.5) * .05; raft.rotation.z = Math.sin(t * 1.2) * .03;
        /* spectator + duck faces */
        const lose = g.result === 'lose', win = g.result === 'win';
        spec.position.y = Math.max(raft.position.y + .15, spec.position.y - dt * 4); spec.rotation.y = .7 + Math.sin(t * 3) * .2;
        const hop = win ? Math.abs(Math.sin((t - rT0) * 9)) * .55 : 0; if (win) spec.position.y = raft.position.y + .15 + hop;
        spec.armL.position.y = 1.45 + (lose ? -.3 : Math.max(0, Math.sin(t * 8)) * .4 + (win ? .7 : 0)); spec.armR.position.y = 1.45 + (lose ? -.3 : Math.max(0, Math.sin(t * 8 + 2)) * .4 + (win ? .7 : 0));
        spec.face(lose ? 'sad' : win ? 'happy' : placed >= NEED - 1 && placed > 0 ? 'worried' : 'eager', 1, t, 0);
        const dy = lose ? 0 : win ? Math.abs(Math.sin((t - rT0) * 8)) * .7 : 0;
        duck.position.y = -1.3 + Math.sin(t * 1.8) * .06 + dy;
        const faceCam = Math.atan2(S.camera.position.x - duck.position.x, S.camera.position.z - duck.position.z);
        duck.rotation.y += ((lose ? faceCam + Math.PI : faceCam) - duck.rotation.y) * Math.min(1, dt * 5);
        duck.rotation.z = Math.sin(t * 1.4) * .06;
        for (const fl of [flag]) if (fl) { fl.pen.rotation.y = Math.sin(t * 9) * .35; fl.pen.position.x = .4; }
        if (win) { TW.rotation.z = 0; }
        if (lose) { wob = Math.max(0, 1 - (t - loseAt) * 1.1); TW.rotation.z = Math.sin((t - loseAt) * 16) * .045 * wob; }
        if (cur && cur.userData.h) { cur.userData.h.rotation.y = Math.sin(t * 4) * .4; cur.userData.h.position.y = cur.position.y + CH / 2 + Math.abs(Math.sin(t * 8)) * .25; cur.userData.h.face('happy'); }
      },
      down() { drop(); }, key(e) { if (e.code === 'Space' || e.code === 'Enter') drop(); },
      draw() {
        X = ctx; _td3.render(S);
        plaque(placed, NEED, NEED > 5 ? 30 : 36, (x, y, on, i) => { X.beginPath(); rr(x - 11, y - 11, 22, 22, 4); ink(on ? PALC[i % PALC.length] : '#8a5530', 3); if (on) { X.fillStyle = 'rgba(255,255,255,.4)'; rr(x - 8, y - 8, 9, 5, 2); X.fill(); } }, popAt, tt);
        if (rT0 >= 0 && g.result === 'win') { const k = tt - rT0; const q = scr(S, spec.position); for (let i = 0; i < 3; i++) { const hk = (k * .9 + i / 3) % 1; heart(q.x + (i - 1) * 24 + Math.sin(hk * 6 + i) * 8, q.y - 70 - hk * 90, .9 + .5 * (1 - hk), '#ff5c8a'); } }
        vignette(.16);
      }
    };
    return g;
  }, 'Stack');

  /* ───────────── 2. BOWL ───────────── */
  /* Place: a retro bowling alley, bunting on the back wall and a telenovela on the TV above the pin machine. The pins have scared faces that
     dizzy-X when knocked (and smirk if they survive). Caos watches from the lane side. The TV shows fireworks on a win, a sad cloud on a loss. */
  reg3('td_bowl', sp => {
    const S = T3.scene({ bg: 0xffd9a0, fog: [26, 60], cam: [0, 2.7, 8.8], look: [0, .8, -8], ground: 0x7be0d6, sun: [3, 10, 4], fov: 50 });
    tune(S, .95, .6);
    const BR = .48, PR = .22, HEADZ = -9, BZ0 = 3;
    const cr = mulberry32(2202);
    const chk = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#8be8dc'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#5fd0c4'; x.fillRect(0, 0, 32, 32); x.fillRect(32, 32, 32, 32); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 30); t.magFilter = THREE.NearestFilter; return t; })();
    toonFloor(S, 0xffffff, chk); S.floor.position.y = -.32;
    const plank = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#f6cf92'; x.fillRect(0, 0, 128, 256); x.strokeStyle = '#d9a35c'; x.lineWidth = 3; for (let i = 1; i < 7; i++) { x.beginPath(); x.moveTo(i * 18.3, 0); x.lineTo(i * 18.3, 256); x.stroke(); } x.strokeStyle = 'rgba(217,163,92,.5)'; x.lineWidth = 2; for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(((i * 37) % 7) * 18.3, i * 28); x.lineTo(((i * 37) % 7) * 18.3 + 14, i * 28 + 2); x.stroke(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 6); return t; })();
    /* lane (planks), gutters, bumpers */
    const laneM = at(S, mbox(3, .2, 19, 0xffffff, .06, plank), [0, -.1, -3]);
    for (const s of [-1, 1]) {
      at(S, mbox(.5, .2, 19, 0x4a3b7a, .05), [s * 1.75, -.2, -3]);
      at(S, mbox(.4, 1.2, 19, 0xff6f91, .06), [s * 2.2, .4, -3]);
      at(S, mbox(.42, .2, 19, 0xffffff, 0), [s * 2.2, 1.02, -3]);
    }
    for (let i = 0; i < 7; i++) at(S, mbox(.14, .02, .5, 0x8a5a2b, 0), [(i - 3) * .36, .01, .8 + Math.abs(i - 3) * .4]);
    at(S, mbox(3, .02, .14, 0xff4d5e, 0), [0, .01, 2.2]);                         // foul line
    /* room: back wall, side walls, ceiling, stripes */
    at(S, mbox(40, 14, .6, 0xffcf70, 0), [0, 6.6, -14.9]); at(S, mbox(40, 2.2, .7, 0xff8a5c, 0), [0, 1.1, -14.7]);
    for (const s of [-1, 1]) { at(S, mbox(.6, 14, 50, 0xffb36b, 0), [s * 11, 6.6, -4]); at(S, mbox(.7, 2.2, 50, 0xff8a5c, 0), [s * 10.8, 1.1, -4]); }
    at(S, mbox(40, .6, 50, 0xfff0c8, 0), [0, 13.4, -4]);
    /* pin machine (pinsetter) with hazard stripe */
    at(S, mbox(5.2, 1.6, .5, 0x2a2f6e, .07), [0, .5, -13.2]); for (let i = 0; i < 9; i++) at(S, mbox(.5, .22, .06, i % 2 ? 0x14101c : 0xffd23f, 0), [(i - 4) * .56, 1.18, -12.92]);
    at(S, mbox(3, .05, 1.2, 0x1b1432, .03), [0, -.18, -12.6]);
    /* TV above the machine + antennas */
    const tvc = document.createElement('canvas'); tvc.width = 160; tvc.height = 100; const tvx = tvc.getContext('2d'); const tvt = new THREE.CanvasTexture(tvc);
    at(S, mbox(4.4, 3.2, .6, 0xff6f91, .09), [0, 3.7, -14.2]);
    const tvs = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 2.5), new THREE.MeshBasicMaterial({ map: tvt })); tvs.position.set(0, 3.7, -13.88); S.scene.add(tvs);
    for (const s of [-1, 1]) { const an = mbox(.07, 1.7, .07, 0x3b3550, .03); an.position.set(s * .7, 6.0, -14.2); an.rotation.z = -s * .55; S.scene.add(an); const ab = msph(.12, 0xffe14d, .03); ab.position.set(s * 1.35, 6.7, -14.2); S.scene.add(ab); }
    let tvState = '', tvAt = -1;
    const tvDraw = (state, t) => {
      const x = tvx, ph = Math.floor(t * 6);
      x.save(); x.fillStyle = state === 'win' ? '#2b1c6e' : state === 'lose' ? '#3a2430' : '#2a2f6e'; x.fillRect(0, 0, 160, 100);
      x.lineCap = x.lineJoin = 'round';
      const face = (cx, cy, col, sad) => { x.beginPath(); x.arc(cx, cy, 22, 0, 7); x.fillStyle = col; x.fill(); x.lineWidth = 4; x.strokeStyle = INKC; x.stroke(); x.fillStyle = INKC; x.beginPath(); x.arc(cx - 8, cy - 4, 3.5, 0, 7); x.arc(cx + 8, cy - 4, 3.5, 0, 7); x.fill(); x.beginPath(); if (sad) x.arc(cx, cy + 16, 7, 1.15 * Math.PI, 1.85 * Math.PI); else x.arc(cx, cy + 6, 7, .1 * Math.PI, .9 * Math.PI); x.stroke(); };
      if (state === 'win') {
        x.translate(80, 50); for (let i = 0; i < 10; i++) { x.rotate(Math.PI / 5); x.fillStyle = i % 2 ? '#ffe14d' : '#ff5c8a'; x.fillRect(8, -3, 36 + Math.sin(t * 14 + i) * 8, 6); }
        x.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, r = i % 2 ? 11 : 24; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fillStyle = '#ffe14d'; x.fill(); x.lineWidth = 4; x.strokeStyle = INKC; x.stroke();
      } else if (state === 'lose') {
        x.beginPath(); x.arc(60, 42, 20, 0, 7); x.arc(88, 38, 24, 0, 7); x.arc(112, 44, 18, 0, 7); x.fillStyle = '#8f98b8'; x.fill(); x.fillStyle = '#9fe3ff'; for (let i = 0; i < 7; i++) { const dy = (t * 80 + i * 17) % 40; x.fillRect(48 + i * 11, 62 + dy, 3, 9); }
        face(80, 36, '#c9d0f0', true);
      } else {                                                                     // the telenovela: two faces lean in, a heart beats, somebody cries
        const lean = Math.sin(t * 1.4) * 7; face(42 + lean, 56, '#ffd0a8', false); face(118 - lean, 56, '#e8b98a', ph % 7 === 0);
        const hs = 1 + Math.sin(t * 8) * .18; x.save(); x.translate(80, 24); x.scale(hs, hs); x.beginPath(); x.moveTo(0, 9); x.bezierCurveTo(-18, -4, -10, -18, 0, -8); x.bezierCurveTo(10, -18, 18, -4, 0, 9); x.fillStyle = '#ff5c8a'; x.fill(); x.lineWidth = 3.5; x.strokeStyle = INKC; x.stroke(); x.restore();
      }
      x.restore(); x.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < 100; y += 4) x.fillRect(0, y, 160, 1.5);
      tvt.needsUpdate = true;
    };
    tvDraw('show', 0);
    /* bunting + ceiling lamps (own RNG for colours) */
    const BC = [0xff5c8a, 0xffe14d, 0x5fd38d, 0x4fb3ff, 0xb98cff];
    const bunt = []; for (let i = 0; i < 17; i++) { const f = mcone(.45, .8, BC[i % 5], .03, 3); f.rotation.x = Math.PI; f.position.set((i - 8) * 1.2, 9.3 + Math.sin(i * .8 + 1) * .05 - Math.abs(i - 8) * .02, -14.3); f.castShadow = false; S.scene.add(f); bunt.push(f); }
    const lamps = [[-5, -4], [5, -4], [0, -9]].map(q => { const l = new THREE.Group(); l.add(mcyl(.05, .05, 4, 0x3b3550, 0, 6)); const sh = mcone(.9, .8, 0xff6f91, .05, 12); sh.position.y = -2.2; l.add(sh); const bl = flat(new THREE.SphereGeometry(.3, 10, 8), 0xfff3a0, { fog: false }); bl.position.y = -2.4; l.add(bl); l.position.set(q[0], 11, q[1]); S.scene.add(l); return l; });
    /* cheering Caos at the foul line */
    at(S, mbox(1.7, 1.4, 1.7, 0xd9944f, .07), [-4.3, .38, .3]); at(S, mbox(1.74, .12, 1.74, 0xf2b878, 0), [-4.3, 1.14, .3]);
    const fan = caos3(S, .5, OR, [-4.3, 1.1, .3]); fan.rotation.y = .55;
    const x0 = (Math.random() < .5 ? -1 : 1) * rnd(.7, 1.05);
    const ball = at(S, msph(BR, 0x3a7bff, .05), [x0, BR, BZ0]);
    for (const [hx, hy] of [[-.2, .15], [.2, .15]]) { const e = msph(.12, 0xffffff, .02); e.scale.set(1, 1.15, .45); e.position.set(hx, hy, BR - .02); e.castShadow = false; ball.add(e); const pu = flat(new THREE.SphereGeometry(.055, 8, 6), 0x14101c); pu.position.set(hx, hy - .01, BR + .035); ball.add(pu); }
    { const m = flat(new THREE.CircleGeometry(.1, 10), 0x14101c); m.position.set(0, -.14, BR + .005); ball.add(m); }
    const pinFace = (mood) => {
      const key = 'pin|' + mood; if (FT[key]) return FT[key];
      const c = document.createElement('canvas'); c.width = 96; c.height = 64; const x = c.getContext('2d'); x.lineCap = x.lineJoin = 'round';
      const eye = (cx, r, pr) => { x.beginPath(); x.arc(cx, 26, r, 0, 7); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 4; x.strokeStyle = INKC; x.stroke(); x.beginPath(); x.arc(cx, 28, pr, 0, 7); x.fillStyle = INKC; x.fill(); };
      x.lineWidth = 4; x.strokeStyle = INKC;
      if (mood === 0) { eye(30, 11, 5); eye(66, 11, 5); x.beginPath(); x.arc(48, 52, 6, 0, 7); x.fillStyle = INKC; x.fill(); }
      else if (mood === 1) { eye(30, 14, 3.5); eye(66, 14, 3.5); x.beginPath(); x.ellipse(48, 52, 9, 8, 0, 0, 7); x.fillStyle = INKC; x.fill(); }
      else if (mood === 2) { x.lineWidth = 6; for (const cx of [30, 66]) { x.beginPath(); x.moveTo(cx - 9, 17); x.lineTo(cx + 9, 35); x.moveTo(cx + 9, 17); x.lineTo(cx - 9, 35); x.stroke(); } x.lineWidth = 4; x.beginPath(); x.moveTo(34, 52); x.lineTo(42, 46); x.lineTo(50, 54); x.lineTo(58, 46); x.lineTo(64, 52); x.stroke(); }
      else { eye(30, 11, 5); eye(66, 11, 5); x.fillStyle = '#fff6e0'; x.fillRect(16, 10, 28, 15); x.fillRect(52, 10, 28, 15); x.lineWidth = 5; x.beginPath(); x.moveTo(18, 25); x.lineTo(44, 25); x.moveTo(52, 25); x.lineTo(80, 25); x.stroke(); x.beginPath(); x.arc(48, 44, 14, .15 * Math.PI, .85 * Math.PI); x.stroke(); }
      return FT[key] = new THREE.CanvasTexture(c);
    };
    const pins = [];
    const axis = new THREE.Vector3(0, 0, 0);
    for (let r = 0; r < 4; r++) for (let k = 0; k <= r; k++) {
      const gp = new THREE.Group();
      const b = mcyl(.15, .21, .6, 0xfff6e0, .035); b.position.y = .3; gp.add(b);
      const n = mcyl(.1, .15, .3, 0xfff6e0, .035); n.position.y = .72; gp.add(n);
      const h = msph(.15, 0xfff6e0, .035); h.position.y = .98; gp.add(h);
      const st = mcyl(.115, .13, .07, 0xe8433a, .03); st.position.y = .8; gp.add(st);
      const fm = new THREE.MeshBasicMaterial({ map: pinFace(0), transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const fc = new THREE.Mesh(new THREE.PlaneGeometry(.27, .18), fm); fc.position.set(0, .98, .146); gp.add(fc);
      gp.scale.setScalar(1.12);
      const x = (k - r / 2) * .64, z = HEADZ - r * .56;
      gp.position.set(x, 0, z); gp.traverse(m => { if (m.isMesh && !m.userData.outline) { m.castShadow = m !== fc; m.receiveShadow = true; } }); S.scene.add(gp);
      pins.push({ m: gp, x, z, vx: 0, vz: 0, st: 0, tilt: 0, ax: 0, az: 0, fm, mood: 0, ph: pins.length });
    }
    const bl = { x: x0, z: BZ0, vx: 0, vz: 0, y: BR, spin: 0 };
    let phase = 'aim', drag = null, ang = 0, charge = 0, charging = false, kt = 0, settle = 0, hitSfx = 0, down = 0, camZ = 8.8, camX = 0, ballSc = null, tt = 0, rT0 = -1, popAt = -9;
    const setMood = (p, m) => { if (p.mood !== m) { p.mood = m; p.fm.map = pinFace(m); } };
    const knock = (p, vx, vz) => {
      if (p.st) return; p.st = 1; p.vx = vx; p.vz = vz; const l = Math.hypot(vx, vz) || 1; p.ax = vz / l; p.az = -vx / l; down++; popAt = tt; setMood(p, 2);
      if (hitSfx <= 0) { sfx.hit(); sfx.thud(); hitSfx = .06; } else sfx.tick();
      const q = scr(S, p.m.position); burst(q.x, q.y - 40, '#fff', 4, 150);
    };
    const launch = (pw, a) => {
      const v = 9 + 14 * pw; ang = a; bl.vx = Math.sin(a) * v; bl.vz = -Math.cos(a) * v; phase = 'roll'; sfx.whoosh(true); drag = null; charging = false;
    };
    const pwOf = dy => cl((dy - 8) / 170, .12, 1);
    const g = {
      wide: true, cmd: 'BOWL!', hint: 'DRAG BACK, RELEASE', thint: 'DRAG BACK, LET GO', dur: 7,
      down(p) { if (phase !== 'aim') return; drag = { sx: p.x, sy: p.y, cx: p.x, cy: p.y }; sfx.click(); },
      move(p) { if (drag) { drag.cx = p.x; drag.cy = p.y; } },
      up(p) {
        if (phase !== 'aim' || !drag) return; drag.cx = p.x; drag.cy = p.y;
        const dy = drag.cy - drag.sy, dx = drag.cx - drag.sx;
        launch(dy > 14 ? pwOf(dy) : .55, cl(-dx * .0009, -.2, .2));
      },
      key(e) {
        if (phase !== 'aim') return;
        if (e.code === 'ArrowLeft') ang = cl(ang + .012, -.2, .2); if (e.code === 'ArrowRight') ang = cl(ang - .012, -.2, .2);
        if (e.code === 'Space' && !charging) { charging = true; kt = 0; }
      },
      keyup(e) { if (e.code === 'Space' && charging && phase === 'aim') launch(.3 + .7 * (1 - Math.cos(kt * 5)) / 2, ang); },
      update(dt, t) {
        tt = t;
        if (hitSfx > 0) hitSfx -= dt;
        if (charging) kt += dt;
        if (phase === 'aim') { bl.y = BR + Math.sin(t * 5) * .03; if (drag) ang = cl(-(drag.cx - drag.sx) * .0009, -.2, .2); }
        if (phase === 'roll') {
          const sub = 3, h = dt / sub;
          for (let s = 0; s < sub; s++) {
            bl.x += bl.vx * h; bl.z += bl.vz * h;
            if (Math.abs(bl.x) > 1.42) {                              // gutter ball
              if (bl.y > .3) sfx.thud(); bl.x = Math.sign(bl.x) * 1.7; bl.vx = 0; bl.y = Math.max(.12, bl.y - 3 * h);
            }
            if (bl.z < -12.6) { bl.z = -12.6; bl.vz *= .1; bl.vx *= .1; }
            for (const p of pins) {
              const dx = p.x - bl.x, dz = p.z - bl.z, d2 = dx * dx + dz * dz, rr = BR + PR;
              if (!p.st && d2 < rr * rr && Math.abs(bl.x) < 1.42) {
                const d = Math.sqrt(d2) || .001, nx = dx / d, nz = dz / d, sped = Math.hypot(bl.vx, bl.vz);
                knock(p, bl.vx * .95 + nx * 3, bl.vz * .95 + nz * 3);
                bl.vx -= nx * sped * .06; bl.vz *= .985;
              }
            }
            for (const a of pins) if (a.st && Math.hypot(a.vx, a.vz) > 1.2) for (const b of pins) {
              if (b.st) continue; const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
              if (d2 < .2) { const d = Math.sqrt(d2) || .001, sv = Math.hypot(a.vx, a.vz); knock(b, a.vx * .8 + dx / d * 2.2, a.vz * .8 + dz / d * 2.2); a.vx *= .75; a.vz *= .75; if (sv > 5) shake(2, .08); }
            }
          }
          if (bl.z < HEADZ + 2) settle += dt;
          if (!g.result && bl.z < HEADZ - 1) shake(3, .05);
          if (!g.result && settle > 1.5) {
            phase = 'done';
            if (down >= 6) { g.result = 'win'; sfx.sparkle(); sfx.coin(); }
            else { g.result = 'lose'; sfx.buzz(); }
            const q = { x: W / 2, y: 250 };
            if (down >= 10) { floatText('STRIKE!', q.x, q.y, '#FFE14D', 70); ring(q.x, q.y, '#FFE14D', 200); burst(q.x, q.y, '#FFE14D', 30); }
            else floatText(window.t('{n} PINS', { n: down }), q.x, q.y, down >= 6 ? '#FFE14D' : '#ff5a5a', 56);
          }
        }
        if (g.result && rT0 < 0) rT0 = t;
        const near = phase === 'roll' ? cl(1 - (bl.z - HEADZ) / 14, 0, 1) : 0;
        for (const p of pins) {
          if (p.st) {
            p.x += p.vx * dt; p.z += p.vz * dt; const f = Math.exp(-1.7 * dt); p.vx *= f; p.vz *= f;
            if (p.z < -12.2) { p.z = -12.2; p.vz *= -.3; } if (Math.abs(p.x) > 2.1) { p.x = Math.sign(p.x) * 2.1; p.vx *= -.4; }
            p.tilt = Math.min(Math.PI / 2, p.tilt + dt * 6);
            axis.set(p.ax, 0, p.az); p.m.quaternion.setFromAxisAngle(axis, p.tilt); p.m.position.set(p.x, p.tilt > 1.4 ? .12 : 0, p.z);
          } else {
            p.m.rotation.z = Math.sin(t * 26 + p.ph * 1.7) * .05 * near; p.m.rotation.x = Math.sin(t * 22 + p.ph) * .03 * near;
            setMood(p, g.result ? 3 : near > .35 ? 1 : 0);
          }
        }
        if (phase !== 'aim') bl.spin -= Math.hypot(bl.vx, bl.vz) * dt / BR;
        ball.position.set(bl.x, bl.y, bl.z); ball.rotation.x = bl.spin;
        const tz = Math.max(bl.z + 6.2, -2.6), tx = bl.x * .45;
        camZ += (tz - camZ) * Math.min(1, dt * 6); camX += (tx - camX) * Math.min(1, dt * 5);
        S.camera.position.set(camX, 2.7 - (8.8 - camZ) * .045, camZ);
        S.camera.lookAt(camX * .6, .7, Math.max(bl.z - 9, HEADZ - 3));
        /* live decor */
        const st = g.result === 'win' ? 'win' : g.result === 'lose' ? 'lose' : 'show';
        const bucket = Math.floor(t * 12); if (st !== tvState || bucket !== tvAt) { tvState = st; tvAt = bucket; tvDraw(st, t); }
        bunt.forEach((f, i) => { f.rotation.z = Math.sin(t * 2 + i * .7) * .12; });
        lamps.forEach((l, i) => { l.rotation.z = Math.sin(t * 1.3 + i * 2) * .035; });
        const win = g.result === 'win', lose = g.result === 'lose', k = rT0 >= 0 ? t - rT0 : 0;
        fan.rotation.y = .55 + Math.sin(t * 2.3) * .12; fan.position.y = 1.1 + (win ? Math.abs(Math.sin(k * 9)) * .5 : 0);
        fan.armL.position.y = 1.45 + (lose ? -.3 : Math.max(0, Math.sin(t * 8)) * .3 + (win ? .8 : 0)); fan.armR.position.y = 1.45 + (lose ? -.3 : Math.max(0, Math.sin(t * 8 + 2)) * .3 + (win ? .8 : 0));
        fan.face(lose ? 'sad' : win ? 'happy' : phase === 'roll' ? 'worried' : 'eager', 1, t, 1);
      },
      draw(t) {
        X = ctx; _td3.render(S);
        if (phase === 'aim') {
          const a = scr(S, ball.position), px = bl.x + Math.sin(ang) * 11, pz = bl.z - Math.cos(ang) * 11;
          const b = scr(S, S.camera.position.clone().set(px, .6, pz));
          ctx.save(); ctx.setLineDash([16, 12]); ctx.lineCap = 'round'; ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.lineWidth = 4; ctx.strokeStyle = '#FFE14D'; ctx.stroke(); ctx.restore();
          let pw = -1; if (drag) pw = (drag.cy - drag.sy) > 14 ? pwOf(drag.cy - drag.sy) : 0; else if (charging) pw = .3 + .7 * (1 - Math.cos(kt * 5)) / 2;
          if (pw >= 0) { meter(W + OX - 84, 180, 34, 260, pw, null); txt('POWER', W + OX - 67, 158, 22, '#fff'); }
          if (drag) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(drag.sx, drag.sy); ctx.lineTo(drag.cx, drag.cy); ctx.stroke(); circ(drag.cx, drag.cy, 10, '#fff', 3); }
        }
        plaque(down, 10, 22, (x, y, on, i) => {                // ten tiny pins, the knocked ones light up
          X.beginPath(); X.moveTo(x - 4, y - 12); X.lineTo(x + 4, y - 12); X.quadraticCurveTo(x + 6, y - 2, x + 9, y + 11); X.lineTo(x - 9, y + 11); X.quadraticCurveTo(x - 6, y - 2, x - 4, y - 12); X.closePath(); ink(on ? '#FFE14D' : '#8a5530', 2.5);
          if (i === 5) { X.fillStyle = on ? '#5CFF7A' : '#c4874e'; X.beginPath(); X.arc(x, y + 17, 2.5, 0, 7); X.fill(); }
        }, popAt, tt, 14 + (78 + 220) / 2, 488);
        if (rT0 >= 0 && g.result === 'win') { const k = tt - rT0; for (let i = 0; i < 6; i++) spark(60 + i * 134 + Math.sin(k * 5 + i) * 10, 140 + ((k * 90 + i * 70) % 360), 10 + (i % 3) * 3, i % 2 ? '#FFE14D' : '#ff5c8a'); }
        vignette(.14);
      }
    };
    return g;
  }, 'Bowl');

  /* ───────────── 3. DIVE ───────────── */
  /* Place: skydiving over a cow farm. Goggled Caos with a face that reacts to the next ring, flying cows with propeller beanies for a background
     gag. Win: spin, gold medal and 3D confetti flying at the camera. Lose: the pack pops a rubber chicken instead of a chute. */
  reg3('td_dive', sp => {
    const kw = VW / W, NEED = 3 + (sp > 1.6 ? 1 : 0), RR = 2.7 - (sp - 1) * .2, SPD = 20 + 6 * (sp - 1), GAP = 20;
    const S = T3.scene({ bg: 0x8fdcff, fog: [30, 95], cam: [0, 7, 11], look: [0, -6, 0], sun: [4, 20, 8] });
    S.sun.castShadow = false; tune(S, .95, .6);
    skyBg(S, 'dive', [[0, '#6cc7fa'], [.13, '#8fdcff'], [1, '#8fdcff']], 0x8fdcff);
    const cr = mulberry32(3303);
    const fields = (() => {                                                          // patchwork farmland: fields, a barn, a pond, cows (baked once, tiled)
      const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.lineJoin = 'round'; x.lineCap = 'round';
      x.fillStyle = '#79cf62'; x.fillRect(0, 0, 256, 256); const cs = ['#8fdc5c', '#7bcf55', '#9be38a', '#6fc65f', '#bfdc74'];
      for (let gx = 0; gx < 4; gx++) for (let gy = 0; gy < 4; gy++) { x.fillStyle = cs[(gx * 3 + gy * 2) % 5]; x.fillRect(gx * 64 + 3, gy * 64 + 3, 58, 58); x.strokeStyle = 'rgba(40,110,50,.22)'; x.lineWidth = 2; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(gx * 64 + 6, gy * 64 + 8 + i * 11); x.lineTo(gx * 64 + 58, gy * 64 + 8 + i * 11); x.stroke(); } }
      x.fillStyle = '#e8d29a'; x.fillRect(125, 0, 6, 256); x.fillRect(0, 125, 256, 6);
      x.beginPath(); x.ellipse(200, 60, 24, 15, 0, 0, 7); x.fillStyle = '#4cc4e8'; x.fill(); x.lineWidth = 4; x.strokeStyle = '#f4d998'; x.stroke();
      x.fillStyle = '#e8433a'; x.fillRect(40, 168, 40, 30); x.strokeStyle = INKC; x.lineWidth = 4; x.strokeRect(40, 168, 40, 30); x.beginPath(); x.moveTo(36, 170); x.lineTo(60, 150); x.lineTo(84, 170); x.closePath(); x.fillStyle = '#9a2a2a'; x.fill(); x.stroke();
      for (const q of [[170, 200], [196, 214], [150, 222], [90, 40], [60, 70]]) { x.fillStyle = '#fff'; x.beginPath(); x.ellipse(q[0], q[1], 7, 4.5, 0, 0, 7); x.fill(); x.fillStyle = '#2a2438'; x.beginPath(); x.arc(q[0] - 2, q[1], 2.3, 0, 7); x.fill(); }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); return t; })();
    const gnd = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), tm(0xffffff, fields)); gnd.rotation.x = -Math.PI / 2; gnd.position.y = -70; S.scene.add(gnd);
    const P = new THREE.Group(), cl3 = caos3(null, .5, OR, null, 1); cl3.position.set(0, -1.1, 0); P.add(cl3); P.rotation.x = -.42; at(S, P, [0, 0, 0]); P.traverse(m => { m.castShadow = false; });
    const chick = new THREE.Group(); { const cb = msph(.5, 0xffe14d, .05); cb.scale.set(1, .85, 1.15); chick.add(cb); const bk = mcone(.18, .4, 0xff8a2b, .03, 8); bk.rotation.x = Math.PI / 2; bk.position.set(0, .1, .62); chick.add(bk); for (const sx of [-1, 1]) { const w = mbox(.5, .08, .35, 0xffd23f, .03); w.position.set(sx * .55, .1, 0); w.rotation.z = sx * .4; w.userData.w = sx; chick.add(w); } const cm = mbox(.12, .3, .3, 0xff4d5e, .03); cm.position.set(0, .55, .1); chick.add(cm); }
    chick.position.set(1.8, -.1, -.4); chick.scale.setScalar(0); P.add(chick); chick.traverse(m => { m.castShadow = false; });
    const medal = new THREE.Group(); { const mr = mtor(.35, .08, 0xffe14d, .03); medal.add(mr); const md = mcyl(.28, .28, .08, 0xffd23f, .03); md.rotation.x = Math.PI / 2; medal.add(md); } medal.position.set(0, -.2, 1.3); medal.scale.setScalar(0); P.add(medal); medal.traverse(m => { m.castShadow = false; });
    const clouds = [];
    for (let i = 0; i < 16; i++) {
      const c = puff(1, .06);
      c.position.set((Math.random() < .5 ? -1 : 1) * rnd(5, 16) * kw, rnd(-60, 10), rnd(-16, -6)); S.scene.add(c); clouds.push(c);
    }
    const streaks = [], smat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55 }), sgeo = new THREE.BoxGeometry(.06, 4, .06);
    for (let i = 0; i < 14; i++) { const s = new THREE.Mesh(sgeo, smat); s.position.set((Math.random() < .5 ? -1 : 1) * rnd(1.5, 9) * kw, rnd(-20, 10), rnd(-6, 5)); S.scene.add(s); streaks.push(s); }
    /* background gag: flying cows with propeller beanies drifting up past you (own RNG, own pool) */
    const cows = [];
    const mkCow = () => {
      const c = new THREE.Group(); const body = mbox(1.8, 1, 1.1, 0xffffff, .07); body.position.y = .2; c.add(body);
      for (const [sx, sy, sz, sc] of [[-.3, .55, .25, .5], [.45, .5, -.2, .4]]) { const sp_ = mbox(.5 * sc * 2, .06, .5 * sc * 2, 0x2a2438, 0); sp_.position.set(sx, sy, sz); c.add(sp_); }
      const head = mbox(.7, .65, .65, 0xffffff, .06); head.position.set(1.1, .55, 0); c.add(head);
      const snout = mbox(.3, .35, .55, 0xffb0c0, .04); snout.position.set(1.5, .42, 0); c.add(snout);
      for (const sz of [-1, 1]) { const eye = flat(new THREE.SphereGeometry(.11, 8, 6), 0xffffff); eye.position.set(1.28, .78, sz * .28); c.add(eye); const pu = flat(new THREE.SphereGeometry(.06, 8, 6), 0x14101c); pu.position.set(1.37, .78, sz * .28); c.add(pu); const horn = mcone(.08, .28, 0xf4e3b0, .02, 6); horn.position.set(1.05, 1.0, sz * .22); c.add(horn); }
      for (const [lx, lz] of [[-.6, -.3], [-.6, .3], [.6, -.3], [.6, .3]]) { const l = mbox(.2, .5, .2, 0xffffff, .04); l.position.set(lx, -.5, lz); c.add(l); }
      const beanie = mcone(.35, .3, 0xff4d5e, .03, 10); beanie.position.set(1.05, 1.0, 0); c.add(beanie);
      const prop = new THREE.Group(); const bl1 = mbox(.9, .05, .12, 0xffe14d, .02); prop.add(bl1); const bl2 = mbox(.12, .05, .9, 0xffe14d, .02); prop.add(bl2); prop.position.set(1.05, 1.35, 0); c.add(prop); c.userData.prop = prop;
      c.traverse(m => { m.castShadow = false; }); return c;
    };
    for (let i = 0; i < 3; i++) { const c = mkCow(); c.userData.sd = i; c.userData.x = (i % 2 ? 1 : -1) * (4 + cr() * 2) * kw; c.userData.y = -30 - i * 28 - cr() * 8; c.position.set(c.userData.x, c.userData.y, -3 - cr() * 2); c.scale.setScalar(2); c.rotation.y = i % 2 ? -.5 : .5; S.scene.add(c); cows.push(c); }
    const rings = [];
    for (let i = 0; i < 6; i++) {
      const m = mtor(RR, .28, 0xffc93c, .07); m.position.set(0, -999, 0); m.rotation.set(Math.PI / 2, 0, 0); m.visible = false; m.castShadow = false; S.scene.add(m);
      rings.push({ m, on: false, st: 0, x: 0, z: 0, y: -999, a: 0, mat: m.material });
    }
    const conf = []; for (let i = 0; i < 28; i++) { const cf = flat(new THREE.PlaneGeometry(.42, .26), [0xffe14d, 0xff5c8a, 0x5cff7a, 0x4db8ff, 0xffffff][i % 5], { side: THREE.DoubleSide }); cf.visible = false; cf.castShadow = false; S.scene.add(cf); conf.push({ m: cf, vx: 0, vy: 0, vz: 0, r: i * .7 }); }
    let got = 0, tgt = { x: 0, z: 0 }, pos = { x: 0, z: 0 }, vx = 0, spawnT = 0, nextX = 0, nextZ = 0, camX = 0, shk = 0, first = true, lastRingMiss = 0, tt = 0, popAt = -9, rT0 = -1, mood = 'eager';
    const R = { x: 5.2, z: 2 }, kd = {};
    const spawnRing = () => {
      const r = rings.find(q => !q.on); if (!r) return;
      nextX = cl(nextX + rnd(-4.5, 4.5), -R.x, R.x); nextZ = cl(nextZ + rnd(-1.5, 1.5), -R.z, R.z); // depth is hard to read from above, so keep it gentle
      r.on = true; r.st = 0; r.x = nextX; r.z = nextZ; r.y = first ? -22 : -40; first = false; r.a = 0;
      r.m.visible = true; r.m.scale.setScalar(1); r.mat.transparent = false; r.mat.opacity = 1; r.mat.color.setHex(0xffc93c);
    };
    const setT = p => { tgt.x = cl((p.x / W - .5) * 2 * R.x, -R.x, R.x); tgt.z = cl((p.y / H - .5) * 2 * R.z, -R.z, R.z); };
    const g = {
      wide: true, cmd: 'DIVE!', hint: 'STEER THROUGH THE RINGS', thint: 'DRAG TO STEER', dur: 7,
      move(p) { setT(p); }, down(p) { setT(p); },
      key(e) { kd[e.code] = 1; }, keyup(e) { kd[e.code] = 0; },
      update(dt, t) {
        tt = t; if (g.result && rT0 < 0) {
          rT0 = t;
          if (g.result === 'win') for (const c of conf) { c.m.visible = true; c.m.position.set(pos.x, 0, pos.z); c.vx = (cr() - .5) * 8; c.vy = 5 + cr() * 7; c.vz = 1 + cr() * 5; }
        }
        if (kd.ArrowLeft || kd.KeyA) tgt.x = cl(tgt.x - 11 * dt, -R.x, R.x); if (kd.ArrowRight || kd.KeyD) tgt.x = cl(tgt.x + 11 * dt, -R.x, R.x);
        if (kd.ArrowUp || kd.KeyW) tgt.z = cl(tgt.z - 9 * dt, -R.z, R.z); if (kd.ArrowDown || kd.KeyS) tgt.z = cl(tgt.z + 9 * dt, -R.z, R.z);
        const nr = rings.find(r => r.on && r.st === 0 && r.y > -10 && r.y < 0);
        if (nr && !g.result && Math.hypot(tgt.x - nr.x, tgt.z - nr.z) < RR + 1.8) { const a = Math.min(1, dt * 4); tgt.x += (nr.x - tgt.x) * a; tgt.z += (nr.z - tgt.z) * a; }
        const px = pos.x, k = Math.min(1, dt * 7); pos.x += (tgt.x - pos.x) * k; pos.z += (tgt.z - pos.z) * k; vx = (pos.x - px) / Math.max(dt, .001);
        P.position.set(pos.x, 0, pos.z); P.rotation.z = cl(-vx * .05, -.6, .6); P.rotation.y = Math.sin(t * 2.2) * .12;
        const fl = Math.sin(t * 14);
        cl3.armL.position.y = 1.45 + fl * .25; cl3.armR.position.y = 1.45 - fl * .25; cl3.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 12 + i * 1.3) * .5; });
        spawnT -= dt; if (!g.result && spawnT <= 0) { spawnRing(); spawnT = GAP / SPD; }
        for (const r of rings) if (r.on) {
          const py = r.y; r.y += SPD * dt; r.m.position.set(r.x, r.y, r.z);
          if (r.st === 0) {
            r.m.rotation.z += dt * .8;
            if (py < 0 && r.y >= 0) {
              if (Math.hypot(pos.x - r.x, pos.z - r.z) < RR - .05) {
                r.st = 1; got++; popAt = t; const q = scr(S, P.position);
                sfx.coin(); sfx.sparkle(); ring(q.x, q.y, '#FFE14D', 120); burst(q.x, q.y, '#FFE14D', 16); floatText('+1', q.x, q.y - 50, '#fff', 44); shk = .35; r.mat.color.setHex(0x5fe08a); r.mat.transparent = true;
                if (got >= NEED) { g.result = 'win'; sfx.sparkle(); }
              } else { r.st = 2; r.mat.color.setHex(0xff5a5a); sfx.miss(); lastRingMiss = .5; }
            }
          } else if (r.st === 1) { r.a += dt * 2.5; r.m.scale.setScalar(1 + r.a * 1.2); r.mat.opacity = Math.max(0, 1 - r.a); if (r.a >= 1) { r.on = false; r.m.visible = false; } }
          if (r.y > 14) { r.on = false; r.m.visible = false; }
        }
        for (const c of clouds) { c.position.y += SPD * dt; if (c.position.y > 14) c.position.set((Math.random() < .5 ? -1 : 1) * rnd(5, 16) * kw, -62 - Math.random() * 10, rnd(-16, -6)); }
        for (const s of streaks) { s.position.y += SPD * 1.7 * dt; if (s.position.y > 12) s.position.set((Math.random() < .5 ? -1 : 1) * rnd(1.5, 9) * kw, -22, rnd(-6, 5)); }
        for (const c of cows) {                                                    // flying cows (decor RNG only)
          c.userData.y += SPD * .8 * dt; c.position.y = c.userData.y; c.position.x = c.userData.x + Math.sin(t * 1.5 + c.userData.sd) * .5; c.rotation.z = Math.sin(t * 2 + c.userData.sd) * .12; c.userData.prop.rotation.y = t * 18;
          if (c.userData.y > 16) { c.userData.y = -70 - cr() * 20; c.userData.x = (cr() < .5 ? -1 : 1) * (4 + cr() * 2) * kw; }
        }
        gnd.position.y = -70 + t * 11;
        camX += (pos.x * .55 - camX) * Math.min(1, dt * 4); shk = Math.max(0, shk - dt);
        S.camera.position.set(camX, 7, 11); S.camera.lookAt(camX, -6, 0); if (shk > 0) T3.shakeCam(S, shk * .6);
        lastRingMiss = Math.max(0, lastRingMiss - dt);
        /* face + payoffs */
        const nxt = rings.find(r => r.on && r.st === 0 && r.y > -16 && r.y < 0), off = nxt ? Math.hypot(pos.x - nxt.x, pos.z - nxt.z) : 0, k2 = rT0 >= 0 ? t - rT0 : 0;
        mood = g.result === 'win' ? 'happy' : g.result === 'lose' ? 'panic' : lastRingMiss > 0 ? 'sad' : t - popAt < .5 ? 'happy' : nxt && off > RR - .2 && nxt.y > -9 ? 'worried' : 'eager';
        cl3.face(mood, cl(vx * .06, -1, 1), t, 0);
        if (g.result === 'win') { P.rotation.y = Math.sin(k2 * 3) * .12 + Math.min(k2, 1) * Math.PI * 2 * (1 - Math.exp(-k2 * 3)); cl3.armL.position.y = 2.1; cl3.armR.position.y = 2.1; medal.scale.setScalar(outBack(k2 * 3) * 1.2); medal.rotation.y = t * 5; }
        if (g.result === 'lose') { chick.scale.setScalar(outBack(k2 * 3) * 1.1); chick.position.y = -.1 + Math.sin(k2 * 22) * .12; chick.children.forEach(c => { if (c.userData.w) c.rotation.z = c.userData.w * (.4 + Math.sin(k2 * 24) * .7); }); cl3.armL.position.y = 2.1 + Math.sin(k2 * 30) * .2; cl3.armR.position.y = 2.1 - Math.sin(k2 * 30) * .2; }
        for (const c of conf) if (c.m.visible) { c.vy -= 5 * dt; c.m.position.x += c.vx * dt; c.m.position.y += c.vy * dt; c.m.position.z += c.vz * dt; c.m.rotation.x += dt * 7; c.m.rotation.y += dt * 5 + c.r * .01; if (c.m.position.y < -5) c.m.visible = false; }
      },
      draw() {
        X = ctx; _td3.render(S);
        plaque(got, NEED, 40, (x, y, on) => { X.beginPath(); X.ellipse(x, y, 13, 8, 0, 0, 7); X.lineWidth = 11; X.strokeStyle = INK; X.stroke(); X.lineWidth = 6; X.strokeStyle = on ? '#FFE14D' : '#8a5530'; X.stroke(); if (on) { X.fillStyle = 'rgba(255,255,255,.7)'; X.beginPath(); X.ellipse(x - 5, y - 3, 3.5, 1.8, -.3, 0, 7); X.fill(); } }, popAt, tt, 14 + (78 + NEED * 40) / 2, 488);
        if (lastRingMiss > 0 && !g.result) badge('MISSED!', W / 2, 300, 40, '#ff4d5e', '#fff', -.05);
        vignette(.22);
      }
    };
    return g;
  }, 'Dive');

  /* ───────────── 4. HOOP ───────────── */
  /* Place: a boardwalk court on a beach with palms, an umbrella and a fence of seagulls that all turn their heads to follow the ball. The backboard
     has a face (eyes above the rim, the rim is its mouth) that watches the ball, grins on a swish and smirks on a miss. Caos referees on a crate. */
  reg3('td_hoop', sp => {
    const NEED = sp > 1.6 ? 2 : 1, HX = 0, HY = 3.3, HZ = -8.2, RIMR = .62, BRD = .3, BOARDZ = -8.95, GRAV = 18, T = 1.1;
    const SENS = .28 + .12 * (sp - 1), SWEET = .61;
    const S = T3.scene({ bg: 0x8fd3ff, fog: [34, 100], cam: [0, 2.6, 6.5], look: [0, 3, -4], ground: 0xf4d998, sun: [4, 14, 5], fov: 55 });
    tune(S, .95, .6);
    skyBg(S, 'beach', [[0, '#36b0ea'], [.3, '#86d8fb'], [.54, '#d6f7ff'], [1, '#d6f7ff']], 0xd6f7ff);
    toonFloor(S, 0xf4d998);
    const cr = mulberry32(4404);
    const planks = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 192; const x = c.getContext('2d'); for (let i = 0; i < 6; i++) { x.fillStyle = i % 2 ? '#e3a35e' : '#f0b872'; x.fillRect(0, i * 32, 128, 32); x.fillStyle = '#a5622c'; x.fillRect(0, i * 32, 128, 3); } x.fillStyle = 'rgba(165,98,44,.5)'; for (let i = 0; i < 6; i++) x.fillRect(((i * 53) % 100) + 10, i * 32 + 8, 16, 3); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
    at(S, mbox(4, .06, 6.2, 0xffffff, .05, planks), [0, .02, -6.1]);
    at(S, flat(new THREE.TorusGeometry(1.8, .05, 6, 40), 0xffffff), [0, .07, -3], [Math.PI / 2, 0, 0]);
    at(S, flat(new THREE.BoxGeometry(60, .03, .12), 0xffffff), [0, .03, -12]);
    /* sea behind the fence */
    at(S, flat(new THREE.BoxGeometry(300, .05, 70), 0x39b6e6), [0, .02, -60]); at(S, flat(new THREE.BoxGeometry(300, .06, .6), 0xffffff), [0, .03, -25.4]);
    const foam = []; for (let i = 0; i < 20; i++) { const d = flat(new THREE.BoxGeometry(1 + cr() * 1.5, .03, .14), 0xffffff, { transparent: true, opacity: .8 }); d.position.set(cr() * 70 - 35, .06, -27 - cr() * 22); S.scene.add(d); foam.push({ m: d, x: d.position.x, ph: cr() * 6 }); }
    /* pole, arm, backboard with a face */
    at(S, mcyl(.16, .2, 3.6, 0x8a8aa6, .05), [0, 1.8, -10.3]);
    at(S, mcyl(.34, .38, 1.5, 0xffd23f, .05), [0, .75, -10.3]);
    at(S, mbox(.25, .25, 1.4, 0x8a8aa6, .04), [0, 3.2, -9.7]);
    const BF = {};
    const boardTex = (mood, look, blink) => {
      const key = mood + '|' + look + '|' + blink; if (BF[key]) return BF[key];
      const c = document.createElement('canvas'); c.width = 360; c.height = 200; const x = c.getContext('2d'); x.lineCap = x.lineJoin = 'round';
      x.fillStyle = '#eef3ff'; x.fillRect(0, 0, 360, 200); x.fillStyle = '#d6e0ff'; x.beginPath(); x.moveTo(0, 200); x.lineTo(90, 0); x.lineTo(130, 0); x.lineTo(40, 200); x.fill(); x.beginPath(); x.moveTo(110, 200); x.lineTo(190, 0); x.lineTo(210, 0); x.lineTo(130, 200); x.fill();
      x.lineWidth = 12; x.strokeStyle = INKC; x.strokeRect(6, 6, 348, 188);
      x.lineWidth = 8; x.strokeStyle = '#e8433a'; x.strokeRect(115, 78, 130, 95);
      const ey = 40;
      const eye = (cx, r, pr, dx, dy) => { x.beginPath(); x.arc(cx, ey, r, 0, 7); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 6; x.strokeStyle = INKC; x.stroke(); x.beginPath(); x.arc(cx + dx, ey + dy, pr, 0, 7); x.fillStyle = INKC; x.fill(); x.beginPath(); x.arc(cx + dx - pr * .35, ey + dy - pr * .4, pr * .35, 0, 7); x.fillStyle = '#fff'; x.fill(); };
      const cxs = [135, 225];
      x.lineWidth = 9; x.strokeStyle = INKC;
      if (mood === 'happy') { x.lineWidth = 10; for (const cx of cxs) { x.beginPath(); x.arc(cx, ey + 12, 20, 1.15 * Math.PI, 1.85 * Math.PI); x.stroke(); } x.fillStyle = 'rgba(255,90,150,.8)'; for (const bx of [90, 270]) { x.beginPath(); x.ellipse(bx, 60, 16, 9, 0, 0, 7); x.fill(); } }
      else if (mood === 'worried') { for (const cx of cxs) eye(cx, 26, 6, look * 10, 5); x.lineWidth = 8; x.beginPath(); x.moveTo(cxs[0] - 26, ey - 32); x.lineTo(cxs[0] + 16, ey - 46); x.moveTo(cxs[1] - 16, ey - 46); x.lineTo(cxs[1] + 26, ey - 32); x.stroke(); }
      else if (mood === 'smug') { for (const cx of cxs) { x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, ey, 21, 0, 7); x.fill(); x.lineWidth = 6; x.stroke(); x.fillStyle = INKC; x.beginPath(); x.arc(cx + look * 6, ey + 6, 8, 0, 7); x.fill(); x.fillStyle = '#eef3ff'; x.fillRect(cx - 26, ey - 26, 52, 28); x.lineWidth = 8; x.beginPath(); x.moveTo(cx - 24, ey + 2); x.lineTo(cx + 24, ey + 2); x.stroke(); } }
      else { for (const cx of cxs) { if (blink) { x.lineWidth = 9; x.beginPath(); x.moveTo(cx - 20, ey + 2); x.lineTo(cx + 20, ey + 2); x.stroke(); } else eye(cx, 22, 10, look * 9, 3); } }
      return BF[key] = new THREE.CanvasTexture(c);
    };
    const bmat = new THREE.MeshBasicMaterial({ map: boardTex('idle', 0, 0) }), bside = tm(0xffffff);
    const board = fin(new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.0, .14), [bside, bside, bside, bside, bmat, bside]), new THREE.BoxGeometry(3.72, 2.12, .26)); at(S, board, [0, 3.7, BOARDZ]);
    at(S, mtor(RIMR, .06, 0xff6a2b, .035), [HX, HY, HZ], [Math.PI / 2, 0, 0]);
    const net = new THREE.Group();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, ho = new THREE.Group(); ho.rotation.y = -a; const sr = flat(new THREE.BoxGeometry(.045, .8, .045), 0xffffff); sr.position.x = .49; sr.rotation.z = -.285; ho.add(sr); net.add(ho); }
    { const r1 = flat(new THREE.TorusGeometry(.53, .025, 5, 20), 0xffffff); r1.rotation.x = Math.PI / 2; r1.position.y = -.05; net.add(r1); const r2 = flat(new THREE.TorusGeometry(.45, .025, 5, 20), 0xffffff); r2.rotation.x = Math.PI / 2; r2.position.y = -.28; net.add(r2); }
    net.position.set(HX, HY - .4, HZ); S.scene.add(net);
    const rimPts = []; for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2; rimPts.push([HX + Math.cos(a) * RIMR, HZ + Math.sin(a) * RIMR]); }
    const ball = at(S, msph(BRD, 0xff8a2b, .035), [0, .95, 1.8]);
    const lm = new THREE.MeshBasicMaterial({ color: 0x14101c });
    for (const rx of [0, Math.PI / 2]) { const l = new THREE.Mesh(new THREE.TorusGeometry(BRD + .005, .02, 6, 20), lm); l.rotation.y = rx; ball.add(l); }
    const bshadow = blob(S, 0, .05, 1.8, .3);
    /* beach scenery: palms, umbrella, fence of gulls */
    const palm = (x, z, lean, sc) => {
      const p = new THREE.Group(); for (let i = 0; i < 5; i++) { const s = mcyl(.2 - i * .02, .24 - i * .02, 1.1, i % 2 ? 0xb98042 : 0xa5703a, .04, 10); s.position.set(i * .09 * lean, .55 + i * 1.02, 0); s.rotation.z = -lean * .09; p.add(s); }
      const hy = 5.2; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, lf = mcone(.5, 2.8, i % 2 ? 0x2f9a55 : 0x3fb260, .04, 6); lf.scale.set(1, 1, .4); lf.position.set(Math.cos(a) * 1.1 + 4 * .09 * lean, hy - .15, Math.sin(a) * 1.1); lf.rotation.z = Math.cos(a) * 1.25; lf.rotation.x = -Math.sin(a) * 1.25; lf.userData.a = a; p.add(lf); }
      for (const q of [[-.25, 0], [.25, .1]]) { const co = msph(.2, 0x7a4a24, .03); co.position.set(q[0] + .36 * lean, hy - .45, q[1]); p.add(co); }
      p.position.set(x, 0, z); p.scale.setScalar(sc); S.scene.add(p); return p;
    };
    const palms = [palm(-6.8, -9, 1, 1), palm(7.4, -10, -1, 1.15), palm(-12, -12, -1, 1.1)];
    const umb = new THREE.Group(); { const pl = mcyl(.07, .07, 3, 0xf4f4f4, .03, 8); pl.position.y = 1.5; umb.add(pl); }
    for (let i = 0; i < 6; i++) { const w = new THREE.Mesh(new THREE.ConeGeometry(1.8, .9, 6, 1, true, i * Math.PI / 3, Math.PI / 3), new THREE.MeshToonMaterial({ color: i % 2 ? 0xffffff : 0xff4d5e, gradientMap: gmap(), side: THREE.DoubleSide })); w.position.y = 3.1; w.castShadow = true; umb.add(w); }
    { const h = mcone(1.8, .9, 0x14101c, 0, 6); h.material = inkm(); h.scale.setScalar(1.04); h.position.y = 3.1; umb.add(h); h.castShadow = false; }
    umb.position.set(-4, 0, -9.6); umb.rotation.z = .12; S.scene.add(umb);
    const towel = at(S, mbox(2.2, .04, 1.2, 0x4fb3ff, 0), [4.2, .03, -3.6], [0, .4, 0]); for (let i = 0; i < 3; i++) at(S, mbox(2.2, .045, .2, 0xffffff, 0), [4.2, .031, -3.6 + (i - 1) * .4], [0, .4, 0]);
    for (let i = -5; i <= 5; i++) at(S, mbox(.22, 1.4, .22, 0xe3a868, .04), [i * 2, .7, -11]);
    at(S, mbox(24, .2, .14, 0xc4874e, .04), [0, 1.1, -11.1]);
    const gulls = [];
    const mkGull = () => {
      const gg = new THREE.Group(); const body = msph(.34, 0xffffff, .05); body.scale.set(1, .85, 1.3); body.position.y = .25; gg.add(body);
      const head = new THREE.Group(); const hd = msph(.2, 0xffffff, .04); head.add(hd); head.position.set(0, .62, .22); gg.add(head);
      const bk = mcone(.07, .3, 0xff8a2b, .02, 6); bk.rotation.x = Math.PI / 2; bk.position.set(0, -.02, .28); head.add(bk);
      for (const sx of [-1, 1]) { const e = flat(new THREE.SphereGeometry(.05, 8, 6), 0xffffff); e.position.set(sx * .1, .06, .16); head.add(e); const pu = flat(new THREE.SphereGeometry(.03, 6, 5), 0x14101c); pu.position.set(sx * .1, .06, .205); head.add(pu); }
      const wl = mbox(.1, .08, .55, 0xd9dcea, .03), wr = mbox(.1, .08, .55, 0xd9dcea, .03); wl.position.set(-.34, .3, -.05); wr.position.set(.34, .3, -.05); gg.add(wl); gg.add(wr);
      const tl = mbox(.2, .06, .3, 0xd9dcea, .03); tl.position.set(0, .22, -.4); gg.add(tl);
      gg.userData = { head, wl, wr }; gg.traverse(m => { m.castShadow = false; }); return gg;
    };
    for (let i = 0; i < 6; i++) { const gg = mkGull(); gg.position.set(-9 + i * 3.4 + cr() * .8, 1.2, -11); gg.userData.x = gg.position.x; gg.userData.ph = cr() * 6; S.scene.add(gg); gulls.push(gg); }
    /* sky layer */
    const sun = flat(new THREE.SphereGeometry(5, 20, 14), 0xffe14d, { fog: false }); sun.position.set(-34, 26, -75); S.scene.add(sun);
    const halo = flat(new THREE.SphereGeometry(8, 20, 14), 0xfff3a0, { fog: false, transparent: true, opacity: .45 }); halo.position.copy(sun.position); S.scene.add(halo);
    const clouds = [[-30, 24, -70, 1.7], [10, 30, -80, 2], [34, 22, -64, 1.5], [-5, 20, -55, 1.2]].map(q => { const c = puff(q[3], .1); c.position.set(q[0], q[1], q[2]); S.scene.add(c); return c; });
    /* Caos the referee on a crate */
    at(S, mbox(1.4, .9, 1.4, 0xd9944f, .07), [3.7, .45, -3.2]); at(S, mbox(1.44, .12, 1.44, 0xf2b878, 0), [3.7, .93, -3.2]);
    const ref = caos3(S, .6, OR, [3.7, .9, -3.2]); ref.rotation.y = -.5;
    const b = { x: 0, y: .95, z: 1.8, vx: 0, vy: 0, vz: 0 };
    let st = 'ready', flightT = 0, scored = 0, rimHit = 0, rimTouch = false, bounced = 0, readyT = 0, wob = 0, zoom = 0, camShake = 0, restT = 0;
    let pressed = false, hold = 0, drag = null, metering = false, mt = 0, aimX = W / 2, kHeld = false, spin = 0, tt = 0, popAt = -9, rT0 = -1, sadAt = -9, bmood = '';
    const OM = 3.4 + 1.1 * (sp - 1);
    const meterPw = () => (1 - Math.cos(mt * OM)) / 2;
    const readyBall = () => {
      b.x = (Math.random() < .5 ? -1 : 1) * rnd(.7, 2.1); b.y = .95; b.z = 1.8; b.vx = b.vy = b.vz = 0; st = 'ready'; flightT = 0; rimTouch = false; bounced = 0; restT = 0; ball.visible = true; metering = false; pressed = false; drag = null;
    };
    const shoot = (pw, a) => {
      if (st !== 'ready') return;
      const k = 1 + (pw - SWEET) * SENS, tx = cl(a, -1, 1) * 2.5;
      b.vx = (tx - b.x) / T; b.vz = (HZ - b.z) / T * k; b.vy = (HY - b.y + .5 * GRAV * T * T) / T * k;
      st = 'fly'; flightT = 0; metering = false; pressed = false; drag = null; sfx.whoosh(true); sfx.pop();
    };
    const aimOf = x => (x - W / 2) / 260;
    const g = {
      wide: true, cmd: 'SHOOT!', hint: 'FLICK UP TO SHOOT', thint: 'SWIPE UP TO SHOOT', dur: 7,
      down(p) {
        if (st !== 'ready') return;
        if (metering) { shoot(meterPw(), aimOf(aimX)); return; }
        pressed = true; hold = 0; drag = { sx: p.x, sy: p.y, cx: p.x, cy: p.y }; aimX = p.x; sfx.click();
      },
      move(p) { aimX = p.x; if (drag) { drag.cx = p.x; drag.cy = p.y; } },
      up(p) {
        if (!pressed || st !== 'ready') return; pressed = false;
        drag.cx = p.x; drag.cy = p.y; const up = drag.sy - drag.cy, dx = drag.cx - drag.sx;
        if (up > 20) { shoot(cl(up / 250, 0, 1), dx / 260); return; }
        if (hold < .25) { metering = true; mt = 0; sfx.tickHi(); aimX = p.x; }      // quick click: arm the timing meter, click again to shoot
        else shoot(meterPw(), aimOf(p.x));                                           // hold + release on the meter
        drag = null;
      },
      key(e) { if (e.code === 'Space' && st === 'ready' && !kHeld) { kHeld = true; if (metering) { shoot(meterPw(), aimOf(mouse.x)); } else { metering = true; mt = 0; } } },
      keyup(e) { if (e.code === 'Space') { kHeld = false; } },
      update(dt, t) {
        tt = t;
        if (pressed) { hold += dt; if (!drag || drag.sy - drag.cy <= 20) mt = hold; }
        if (metering && !pressed) mt += dt;
        if (rimHit > 0) rimHit -= dt;
        if (st === 'ready') { readyT += dt; ball.position.set(b.x, b.y + Math.sin(readyT * 5) * .04, b.z); }
        else if (st === 'fly' || st === 'rest') {
          flightT += dt; const n = 4, h = Math.min(dt, 1 / 30) / n;
          for (let s = 0; s < n; s++) {
            const py = b.y; b.vy -= GRAV * h; b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
            if (b.y < BRD) {                                                   // floor
              b.y = BRD; if (b.vy < -3) { sfx.thud(); bounced++; } b.vy *= -.55; b.vx *= .8; b.vz *= .8;
              if (Math.abs(b.vy) < 1) b.vy = 0;
            }
            if (b.z - BRD < BOARDZ + .07 && b.z > BOARDZ - .2 && Math.abs(b.x) < 1.8 && b.y > 2.7 && b.y < 4.7 && b.vz < 0) {    // backboard
              b.z = BOARDZ + .07 + BRD; b.vz *= -.55; b.vx *= .9; sfx.thud(); sfx.hit(); camShake = .12; rimTouch = true;
            }
            const sc = scored > 0 && b.y < HY && b.y > HY - .9 && Math.hypot(b.x - HX, b.z - HZ) < RIMR + .1;
            if (sc) { b.vx *= Math.pow(.06, h); b.vz *= Math.pow(.06, h); b.vx -= (b.x - HX) * 10 * h; b.vz -= (b.z - HZ) * 10 * h; b.vy *= Math.pow(.25, h); }
            if (Math.abs(b.y - HY) < .6) for (let i = 0; i < 22; i++) {
              const dx = b.x - rimPts[i][0], dy = b.y - HY, dz = b.z - rimPts[i][1], d2 = dx * dx + dy * dy + dz * dz, rr = BRD + .06;
              if (d2 < rr * rr) {
                const d = Math.sqrt(d2) || .001, nx = dx / d, ny = dy / d, nz = dz / d, vn = b.vx * nx + b.vy * ny + b.vz * nz;
                b.x += nx * (rr - d); b.y += ny * (rr - d); b.z += nz * (rr - d);
                if (vn < 0) { b.vx -= 1.55 * vn * nx; b.vy -= 1.55 * vn * ny; b.vz -= 1.55 * vn * nz; if (rimHit <= 0) { sfx.hit(); sfx.boing(); rimHit = .1; camShake = .08; wob = Math.max(wob, .5); } rimTouch = true; }
              }
            }
            if (py > HY && b.y <= HY && b.vy < 0 && !(st === 'rest') && Math.hypot(b.x - HX, b.z - HZ) < RIMR - .08 && !ball.userData.counted) {
              ball.userData.counted = 1; scored++; wob = 1; zoom = 1; camShake = .25; popAt = t;
              const q = scr(S, ball.position); sfx.coin(); sfx.sparkle(); sfx.pop(); shake(5, .2);
              ring(q.x, q.y, '#FFE14D', 120); burst(q.x, q.y, '#FFE14D', 18); burst(q.x, q.y, '#ff8a2b', 10, 200);
              floatText(rimTouch ? 'NICE!' : 'SWISH!', q.x, q.y - 70, rimTouch ? '#fff' : '#FFE14D', 52);
              if (scored >= NEED) { g.result = 'win'; }
            }
          }
          spin += dt * 8; ball.position.set(b.x, b.y, b.z); ball.rotation.x -= dt * 7; ball.rotation.z += dt * 3;
          if (!g.result && (flightT > 3.4 || (bounced >= 2 && b.y <= BRD + .02) || b.z > 7 || Math.abs(b.x) > 12)) {
            if (st === 'fly') { st = 'rest'; restT = 0; if (!scored || !ball.userData.counted) sadAt = t; }
          }
          if (st === 'rest') { restT += dt; if (restT > .35 && !g.result) { ball.userData.counted = 0; readyBall(); } }
        }
        if (g.result && rT0 < 0) rT0 = t;
        wob = Math.max(0, wob - dt * 1.8); const w = Math.sin(t * 28) * .12 * wob;
        net.scale.set(1 + w, 1 + wob * .12 * Math.sin(t * 20), 1 + w);
        zoom = Math.max(0, zoom - dt * 1.4); camShake = Math.max(0, camShake - dt * .6);
        S.camera.position.set(b.x * .12, 2.6, 6.5 - zoom * .9); S.camera.lookAt(0, 3, -4);
        if (camShake > 0) T3.shakeCam(S, camShake);
        /* live decor + faces */
        bshadow.position.set(ball.position.x, .05, ball.position.z); bshadow.scale.setScalar(cl(1 - (ball.position.y - .3) * .12, .3, 1));
        const k = rT0 >= 0 ? t - rT0 : 0, win = g.result === 'win', fly = st === 'fly' && b.vy !== 0, lk = cl(b.x / 2, -1, 1), blk = Math.sin(t * 1.3 + 2) > .985 ? 1 : 0;
        const lost = g.result === 'lose';
        const bm_ = win || t - popAt < .9 ? 'happy' : lost || t - sadAt < 1 ? 'smug' : fly ? 'worried' : 'idle';
        const key = bm_ + (bm_ === 'happy' ? '' : '|' + Math.round(lk) + '|' + blk); if (key !== bmood) { bmood = key; bmat.map = boardTex(bm_, bm_ === 'happy' ? 0 : Math.round(lk), bm_ === 'idle' ? blk : 0); }
        ref.rotation.y = -.5 + Math.sin(t * 2.4) * .1; ref.position.y = .9 + (win ? Math.abs(Math.sin(k * 9)) * .5 : 0);
        ref.armL.position.y = 1.45 + (t - sadAt < 1 && !win ? -.3 : Math.max(0, Math.sin(t * 8)) * .3 + (win ? .8 : 0)); ref.armR.position.y = 1.45 + (win ? .8 : Math.max(0, Math.sin(t * 8 + 2)) * .3);
        ref.face(win || t - popAt < .9 ? 'happy' : lost || t - sadAt < 1 ? 'sad' : fly ? 'worried' : 'eager', 1, t, 2);
        gulls.forEach((gg, i) => {
          const ud = gg.userData, dx = ball.position.x - ud.x, dz = ball.position.z - gg.position.z, tgtY = Math.atan2(dx, dz);
          ud.head.rotation.y += (cl(tgtY, -1.1, 1.1) - ud.head.rotation.y) * Math.min(1, dt * 8); ud.head.rotation.x = Math.sin(t * 2 + ud.ph) * .06;
          const hop = win ? Math.abs(Math.sin(k * 10 + i)) * .6 : 0, fl = win ? Math.sin(t * 30 + i) * .9 : (t - sadAt < 1 ? Math.sin(t * 22 + i) * .15 : 0);
          gg.position.y = 1.2 + hop + Math.sin(t * 3 + ud.ph) * .015; ud.wl.rotation.z = fl; ud.wr.rotation.z = -fl;
        });
        palms.forEach((p, i) => { p.rotation.z = Math.sin(t * 1.2 + i) * .015; p.children.forEach(c => { if (c.userData.a !== undefined) c.rotation.y = Math.sin(t * 3 + c.userData.a * 2) * .06; }); });
        umb.rotation.z = .12 + Math.sin(t * 1.4) * .012; halo.scale.setScalar(1 + Math.sin(t * 1.5) * .05);
        clouds.forEach((c, i) => { c.position.x = ((c.position.x + 60 + dt * (1.5 + i * .4)) % 130) - 60; });
        foam.forEach(f => { f.m.position.x = f.x + Math.sin(t * .6 + f.ph) * .6; f.m.material.opacity = .45 + Math.sin(t * 1.3 + f.ph) * .35; });
      },
      draw() {
        X = ctx; _td3.render(S);
        if (st === 'ready') {
          let pw = -1;
          if (pressed && drag && drag.sy - drag.cy > 20) pw = cl((drag.sy - drag.cy) / 250, 0, 1);
          else if (pressed || metering) pw = meterPw();
          const bx = W + OX - 70, by = 170, bh = 300;
          meter(bx, by, 34, bh, pw, [SWEET - .11, SWEET + .11]);
          txt('POWER', bx + 17, by - 22, 22, '#fff');
          if (pressed || metering) { ctx.save(); ctx.setLineDash([10, 10]); ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 8; const ax = (drag && drag.sy - drag.cy > 20) ? W / 2 + (drag.cx - drag.sx) : aimX; ctx.beginPath(); ctx.moveTo(ax, 150); ctx.lineTo(ax, 300); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore(); }
          if (drag && pressed) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(drag.sx, drag.sy); ctx.lineTo(drag.cx, drag.cy); ctx.stroke(); }
        }
        plaque(scored, NEED, 44, (x, y, on) => { X.beginPath(); X.arc(x, y, 12, 0, 7); ink(on ? '#ff8a2b' : '#8a5530', 3); if (on) { X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); X.moveTo(x - 12, y); X.lineTo(x + 12, y); X.moveTo(x, y - 12); X.lineTo(x, y + 12); X.stroke(); } }, popAt, tt);
        vignette(.14);
      }
    };
    return g;
  }, 'Hoop');
})();
