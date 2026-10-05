'use strict';
/* 3D stage, part 3: td_cube (match the orientation), td_lanes (3-lane runner), td_crane (claw machine), td_hop (platform hopper).
   All use the T3 toolkit from td_core.js. Per-frame work only mutates pre-built meshes / reused vectors.
   Art: the DUO look (docs/ART-STYLE.md) in 3D: toon (3-step cel) materials + the inverted-hull ink outline, baked canvas textures for
   walls / skies / floors / faces, a real place per game, and 2D "in the world" UI + drawn win/lose payoffs painted over the render. */

const _td3 = {
  V: null, P: null,
  /* lazily created shared scratch objects (THREE must already be loaded) */
  init() { if (!this.V) { this.V = new THREE.Vector3(); this.P = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); } },
  cl: (v, a, b) => v < a ? a : v > b ? b : v,
  /* widescreen: own renderer sized VW×H (the shared T3 one is fixed at 800×600), camera aspect follows VW so wide screens SEE more scene */
  R: null,
  render(S) {
    if (!this.R && !this.bad) {
      try {
        const c = document.createElement('canvas'); c.width = VW; c.height = H;
        this.R = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: false, preserveDrawingBuffer: true });
        this.R.setPixelRatio(1); this.R.shadowMap.enabled = true; this.R.shadowMap.type = THREE.PCFSoftShadowMap;
      } catch (e) { this.bad = true; this.R = null; }
    }
    const R = this.R; if (!R) { T3.render(S); return; }
    if (R.domElement.width !== VW) R.setSize(VW, H, false);
    if (Math.abs(S.camera.aspect - VW / H) > 1e-4) { S.camera.aspect = VW / H; S.camera.updateProjectionMatrix(); }
    S.camera.updateMatrixWorld(); R.render(S.scene, S.camera); ctx.drawImage(R.domElement, -OX, 0, VW, H);
  },
  /* canvas px (game coords, may be <0 / >W) → normalized device coords for raycasting */
  ndc(p) { return new THREE.Vector2((p.x + OX) / VW * 2 - 1, -(p.y / H) * 2 + 1); },
  /* 2D overlay helper: world point (x,y,z) → canvas px, no allocation */
  scr(S, x, y, z) { _td3.init(); _td3.V.set(x, y, z); const q = _td3.V.project(S.camera); return { x: (q.x + 1) / 2 * VW - OX, y: (1 - q.y) / 2 * H, z: q.z }; },
};

/* Everything below lives in an IIFE so the kit helpers (rr, ink, ease, X...) never leak into the shared global scope (_td3 stays global: td1.js and td2.js render through it). */
(() => {
/* ───────────── DUO-look art kit (local; art only, never touches the game RNG) ─────────────
   2D helpers draw on X (the live ctx, or an offscreen canvas while baking textures via onto()). 3D helpers turn the shared T3 meshes
   into cel-shaded toon meshes (3-step gradient) that keep their inverted-hull ink outline, and bake canvas textures once. */
let X = null;   // the live ctx inside every draw(); an offscreen context while a texture is being baked (onto)
const mkC = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const onto = (cv, fn) => { const o = X; X = cv.getContext('2d'); try { fn(); } finally { X = o; } return cv; };
const clp = (v, a, b) => v < a ? a : v > b ? b : v;
const ease = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const outBack = k => { k = clp(k, 0, 1); const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const lerp = (a, b, k) => a + (b - a) * k;
const rr = (x, y, w, h, r, add) => { r = Math.min(r, w / 2, h / 2); if (!add) X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); };
const el = (x, y, rx, ry, rot = 0) => { X.beginPath(); X.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, 7); };
const ink = (fill, o = 4) => { X.lineJoin = 'round'; X.lineCap = 'round'; X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); X.fillStyle = fill; X.fill(); };
/* cel: path builder -> ink outline, shade fill, then the base colour shifted by (-sx,-sy) inside the clip (the shade stays as a crescent) */
const cel = (pf, fill, shade, sx, sy, o = 4) => { pf(); X.lineJoin = 'round'; X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); X.fillStyle = shade; X.fill(); X.save(); X.clip(); X.translate(-sx, -sy); pf(); X.fillStyle = fill; X.fill(); X.restore(); };
const glint = (x, y, rx, ry, rot = -.4, a = .4) => { el(x, y, rx, ry, rot); X.fillStyle = 'rgba(255,255,255,' + a + ')'; X.fill(); };
const tube = (x1, y1, x2, y2, w, col, ol = INK) => { X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); X.moveTo(x1, y1); X.lineTo(x2, y2); X.strokeStyle = ol; X.lineWidth = w + 7; X.stroke(); X.strokeStyle = col; X.lineWidth = w; X.stroke(); };
const heart = (x, y, s, col = '#ff5c8a') => { X.beginPath(); X.moveTo(x, y + s * .9); X.bezierCurveTo(x - s * 1.6, y - s * .2, x - s * .7, y - s * 1.3, x, y - s * .45); X.bezierCurveTo(x + s * .7, y - s * 1.3, x + s * 1.6, y - s * .2, x, y + s * .9); X.closePath(); ink(col, 2.5); };
const sweat = (x, y, s, T = 0, k = 0) => { const f = (T * 1.4 + k) % 1; X.save(); X.globalAlpha = 1 - f * f; const yy = y + f * s * 3; X.beginPath(); X.moveTo(x, yy - s * 1.3); X.quadraticCurveTo(x + s, yy, x, yy + s * .7); X.quadraticCurveTo(x - s, yy, x, yy - s * 1.3); ink('#9fe3ff', 2); X.restore(); };
const spark = (x, y, r, rot, col) => { X.beginPath(); for (let i = 0; i < 8; i++) { const rad = i % 2 ? r * .42 : r, a = rot + i * Math.PI / 4; X.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } X.closePath(); ink(col, 2.5); };
const pill = (x, y, label, col, up) => {
  X.save(); X.font = '700 15px Fredoka, Arial, sans-serif'; const w = Math.max(54, X.measureText(t(label)).width + 26), h = 24; X.restore();
  rr(x - w / 2, y - h / 2, w, h, h / 2); ink(col, 3); rr(x - w / 2 + 5, y - h / 2 + 3, w - 10, 6, 3); X.fillStyle = 'rgba(255,255,255,.35)'; X.fill();
  if (up) { X.beginPath(); X.moveTo(x - 6, y + h / 2 + 3); X.lineTo(x, y + h / 2 + 11); X.lineTo(x + 6, y + h / 2 + 3); X.closePath(); ink(col, 2.5); }
  txt(label, x, y + 1, 15, INK, 'center', w - 10);
};
const keyCap = (x, y, label) => { X.save(); X.font = '700 15px Fredoka, Arial, sans-serif'; const w = Math.max(26, X.measureText(label).width + 16); X.restore(); rr(x - w / 2, y - 11, w, 22, 6); ink('#fff', 2.5); txt(label, x, y + 1, 15, INK, 'center', w - 6); };
/* chunky plate (control / hint): base 9 px below, face on top, optionally pressed */
const plate = (x, y, w, h, face, base, down) => { const d = down ? 3 : 9; rr(x, y + 9, w, h, 18); ink(base, 4); rr(x, y + 9 - d, w, h, 18); ink(face, 4); glint(x + w * .28, y + 9 - d + h * .24, w * .2, h * .1, 0, .4); };

/* faces: one routine for the 2D heroes AND the face texture on the 3D Claude. (cx,cy) = centre of the body front, units = 256x150 face texture */
function eyeP(x, y, r, mood, lx, ly, bl, T, lw) {
  X.lineCap = 'round'; X.lineJoin = 'round';
  if (mood === 'happy') { X.beginPath(); X.arc(x, y + r * .4, r * .78, Math.PI * 1.1, Math.PI * 1.9); X.strokeStyle = INK; X.lineWidth = 6 * lw; X.stroke(); return; }
  if (mood === 'bonk') { X.beginPath(); X.moveTo(x - r * .7, y - r * .8); X.lineTo(x + r * .5, y); X.lineTo(x - r * .7, y + r * .8); X.strokeStyle = INK; X.lineWidth = 6 * lw; X.stroke(); return; }
  if (bl) { X.beginPath(); X.moveTo(x - r * .8, y + r * .1); X.lineTo(x + r * .8, y + r * .1); X.strokeStyle = INK; X.lineWidth = 6 * lw; X.stroke(); return; }
  const sc = mood === 'panic' ? 1.3 : mood === 'eager' ? 1.1 : 1;
  el(x, y, r * sc, r * 1.08 * sc); ink('#fff', r * .14 * lw);
  if (mood === 'dizzy') {
    X.beginPath(); for (let a = 0; a < 15; a += .35) { const rad = a * r * .05, an = a + T * 7; X.lineTo(x + Math.cos(an) * rad, y + Math.sin(an) * rad); }
    X.strokeStyle = INK; X.lineWidth = 3.4 * lw; X.stroke(); return;
  }
  const pr = r * (mood === 'panic' ? .3 : mood === 'sad' ? .46 : .52);
  const px = x + lx * r * .4 * sc, py = y + ly * r * .4 * sc + (mood === 'sad' ? r * .15 : 0);
  X.beginPath(); X.arc(px, py, pr, 0, 7); X.fillStyle = INK; X.fill();
  X.beginPath(); X.arc(px - pr * .35, py - pr * .4, pr * .36, 0, 7); X.fillStyle = '#fff'; X.fill();
}
function drawFace(cx, cy, mood, lx, ly, bl, T, lw = 1) {
  const EX = 60, ER = 25, EY = -14;
  X.fillStyle = 'rgba(255,110,140,' + (mood === 'happy' ? .7 : .5) + ')';
  for (const s of [-1, 1]) { el(cx + s * (EX + 12), cy + EY + 38, 14, 8); X.fill(); }
  for (const s of [-1, 1]) eyeP(cx + s * EX, cy + EY, ER, mood, lx, ly, bl, T, lw);
  X.strokeStyle = INK; X.lineWidth = 6 * lw; X.lineCap = 'round'; X.lineJoin = 'round';
  for (const s of [-1, 1]) {
    const x = cx + s * EX, y = cy + EY - ER;
    if (mood === 'eager') { X.beginPath(); X.moveTo(x - s * 22, y - 12); X.lineTo(x + s * 18, y - 3); X.stroke(); }
    else if (mood === 'sad') { X.beginPath(); X.moveTo(x - s * 20, y - 2); X.lineTo(x + s * 16, y - 15); X.stroke(); }
    else if (mood === 'panic') { X.beginPath(); X.moveTo(x - 18, y - 22); X.quadraticCurveTo(x, y - 34, x + 18, y - 22); X.stroke(); }
  }
  const my = cy + 38;
  X.beginPath();
  if (mood === 'happy') { X.moveTo(cx - 20, my - 6); X.quadraticCurveTo(cx, my + 30, cx + 20, my - 6); X.closePath(); ink('#6a1f33', 3 * lw); el(cx, my + 11, 10, 6); X.fillStyle = '#ff7a95'; X.fill(); }
  else if (mood === 'eager') { X.moveTo(cx - 14, my - 2); X.quadraticCurveTo(cx, my + 12, cx + 14, my - 2); X.stroke(); }
  else if (mood === 'sad') { X.moveTo(cx - 14, my + 8); X.quadraticCurveTo(cx, my - 6, cx + 14, my + 8); X.stroke(); }
  else if (mood === 'panic') { el(cx, my + 4, 12, 15); ink('#6a1f33', 3 * lw); }
  else if (mood === 'dizzy' || mood === 'bonk') { X.moveTo(cx - 18, my + 2); for (let i = 1; i <= 4; i++) X.lineTo(cx - 18 + i * 9, my + (i % 2 ? 9 : 0)); X.stroke(); }
  else { X.moveTo(cx - 10, my); X.lineTo(cx + 10, my); X.stroke(); }
}
/* the 2D Claude hero: blocky arms with square hands behind the core body, my eyes over the core ones. al/ar = hand offset (in u) from the shoulder */
function hero2d(x, y, u, mood, lx, ly, o = {}) {
  const k = u * .0469, al = o.al || [-1.2, 3.2], ar = o.ar || [1.2, 3.2], lift = o.lift || 0;
  shadow(x, y + 1, 7.5 * u, 1.6 * u, .28);
  ctx.save(); ctx.translate(0, -lift);
  for (const [s, a] of [[-1, al], [1, ar]]) {
    const sx = x + s * 6 * u, sy = y - 5 * u, hx = sx + a[0] * u, hy = sy + a[1] * u;
    tube(sx, sy, hx, hy, 1.9 * u, OR);
    rr(hx - 1.3 * u, hy - 1.3 * u, 2.6 * u, 2.6 * u, u * .5); ink(OR, Math.max(2.5, u * .5)); glint(hx - .4 * u, hy - .5 * u, .5 * u, .3 * u, -.5, .55);
  }
  claude(x, y, u, { col: OR, mood: 'none', run: o.run });
  X.fillStyle = OR; X.fillRect(x - 4.4 * u, y - 8.6 * u, 8.8 * u, 4.4 * u);
  X.save(); X.translate(x, y - 5.5 * u); X.scale(k, k); drawFace(0, 0, mood, lx, ly, Math.sin(now * 1.9 + (o.k || 0)) > .985 ? 1 : 0, now, 3); X.restore();
  glint(x - 4 * u, y - 8 * u, 1.6 * u, .5 * u, -.3, .25);
  ctx.restore();
}

/* ───────────── 3D toon helpers ───────────── */
let _gm = null;
const gradMap = () => _gm || (_gm = (() => { const t = new THREE.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, THREE.LuminanceFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; })());
/* swap every Phong/Lambert material in the scene for a 3-step toon one (outline hulls are MeshBasic and stay as they are) */
function toonify(S, hemi, sun) {
  quiet(() => {
  const gm = gradMap();
  const cv = m => {
    if (!(m.isMeshPhongMaterial || m.isMeshLambertMaterial)) return m;
    const n = new THREE.MeshToonMaterial({ color: m.color, map: m.map || null, gradientMap: gm, transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite }); m.dispose(); return n;
  };
  S.scene.traverse(o => {
    if (o.isHemisphereLight && hemi != null) o.intensity = hemi;
    if (o.isDirectionalLight && sun != null) o.intensity = sun;
    if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(cv) : cv(o.material);
  });
  });
}
/* three.js draws UUIDs from Math.random, and party mode seeds Math.random for the game's own setup. Every object built purely for decoration is
   made inside quiet() (a private generator is swapped in), so the seeded stream the game reads is exactly the one the plain version read. */
const dgen = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };   // own copy of mulberry32
const _dq = dgen(90210);
const quiet = fn => { const o = Math.random; Math.random = _dq; try { return fn(); } finally { Math.random = o; } };
const _tx = {};
/* baked canvas texture, cached for the whole session (WebGL textures aren't freed with the scene) */
function cvTex(key, w, h, fn, rep) {
  if (_tx[key]) return _tx[key];
  return quiet(() => {
    const t = new THREE.CanvasTexture(onto(mkC(w, h), fn)); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; }
    return _tx[key] = t;
  });
}
/* flat sprite quad in the scene; fogless and un-lit so it reads like a drawing */
function sprite(S, tex, w, h, pos, add) {
  return quiet(() => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending }));
    m.position.set(pos[0], pos[1], pos[2]); S.scene.add(m); return m;
  });
}
const _faces = [];
/* Claude in 3D with a real face: the T3 mascot plus a transparent face-texture plane on its front; repainted only when mood/look changes */
function hero3(S, s, pos, idx) {
  const cl = T3.claude(S, s, OR, pos);
  cl.eyes.forEach(e => e.visible = false);
  quiet(() => {
    if (!_faces[idx]) { const cv = mkC(256, 150), tx = new THREE.CanvasTexture(cv); tx.minFilter = THREE.LinearFilter; tx.generateMipmaps = false; _faces[idx] = { cv, tx, key: '' }; }
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.7), new THREE.MeshBasicMaterial({ map: _faces[idx].tx, transparent: true, depthWrite: false }));
    pl.position.set(0, 1.62, .93); cl.add(pl);
  });
  const f = _faces[idx]; f.key = '';
  cl.f = f; cl.fk = idx * 1.7; cl.parts = [cl.body, cl.armL, cl.armR, ...cl.legs];
  return cl;
}
function setFace(cl, mood, lx = 0, ly = 0) {
  const f = cl.f, bl = Math.sin(now * 1.9 + cl.fk) > .985 ? 1 : 0;
  const key = mood + '|' + Math.round(lx * 3) + '|' + Math.round(ly * 3) + '|' + bl + (mood === 'dizzy' ? Math.floor(now * 8) : '');
  if (key === f.key) return; f.key = key;
  onto(f.cv, () => { X.clearRect(0, 0, 256, 150); drawFace(128, 75, mood, lx, ly, bl, now, 1.6); });
  f.tx.needsUpdate = true;
}
const tint = (cl, hex) => { for (const p of cl.parts) p.material.color.setHex(hex); };
const mixHex = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k).getHex();
/* shared baked bits */
const cloudTex = () => cvTex('cloud', 256, 128, () => {
  const pf = (dx, dy, s) => { X.beginPath(); for (const [cx, cy, r] of [[70, 80, 34], [112, 58, 42], [160, 70, 38], [196, 86, 28], [128, 90, 40]]) { X.moveTo(cx * s + dx + r * s, cy * s + dy); X.arc(cx * s + dx, cy * s + dy, r * s, 0, 7); } };
  X.lineJoin = 'round'; pf(0, 0, 1); X.lineWidth = 7; X.strokeStyle = '#7fb3e6'; X.stroke(); X.fillStyle = '#e4f5ff'; X.fill();
  pf(-4, -6, .86); X.fillStyle = '#fff'; X.fill();
});
const raysTex = () => cvTex('rays', 256, 256, () => {
  X.translate(128, 128);
  for (let i = 0; i < 12; i++) { X.rotate(Math.PI / 6); X.beginPath(); X.moveTo(0, 0); X.lineTo(-22, -128); X.lineTo(22, -128); X.closePath(); X.fillStyle = 'rgba(255,240,150,.8)'; X.fill(); }
  const g = X.createRadialGradient(0, 0, 0, 0, 0, 128); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); X.globalCompositeOperation = 'destination-out'; X.fillStyle = g; X.fillRect(-128, -128, 256, 256);
});
const sparkTex = () => cvTex('spark', 64, 64, () => { const g = X.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.4, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); X.fillStyle = g; X.fillRect(0, 0, 64, 64); });

/* ───────────── 1. CUBE MATCH: the cube gallery ───────────── */
let _cubeTex = null;
const _cubeCols = ['#ff5a5f', '#4d96ff', '#5fd35c', '#ffd23f', '#b06cff', '#ff9a3c'];
function _cubeTextures() {
  if (_cubeTex) return _cubeTex;
  _cubeTex = _cubeCols.map((col, i) => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = col; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 8; x.strokeRect(10, 10, 108, 108);
    x.translate(64, 64); x.lineJoin = 'round'; x.fillStyle = '#fff'; x.strokeStyle = '#14101c'; x.lineWidth = 7;
    x.beginPath();
    if (i === 0) { for (let k = 0; k < 10; k++) { const r = k % 2 ? 15 : 36, a = -Math.PI / 2 + k * Math.PI / 5; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); }
    else if (i === 1) x.arc(0, 0, 30, 0, 7);
    else if (i === 2) { x.moveTo(0, -34); x.lineTo(34, 28); x.lineTo(-34, 28); x.closePath(); }
    else if (i === 3) x.rect(-28, -28, 56, 56);
    else if (i === 4) { x.moveTo(0, -36); x.lineTo(32, 0); x.lineTo(0, 36); x.lineTo(-32, 0); x.closePath(); }
    else { x.moveTo(-10, -34); x.lineTo(10, -34); x.lineTo(10, -10); x.lineTo(34, -10); x.lineTo(34, 10); x.lineTo(10, 10); x.lineTo(10, 34); x.lineTo(-10, 34); x.lineTo(-10, 10); x.lineTo(-34, 10); x.lineTo(-34, -10); x.lineTo(-10, -10); x.closePath(); }
    x.stroke(); x.fill();
    const t = new THREE.CanvasTexture(c); return t;
  });
  return _cubeTex;
}
/* gallery wall, 44 x 15 world units at 25 px/unit: wallpaper, chair rail, wainscot, and a banana duct-taped to the wall */
const cubeWallTex = () => cvTex('cubeWall', 1100, 370, () => {
  const w = 1100, h = 370, g = X.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#d9a86a'); g.addColorStop(1, '#ffe0a8'); X.fillStyle = g; X.fillRect(0, 0, w, h);
  X.fillStyle = 'rgba(200,120,70,.16)'; for (let x = 0; x < w; x += 72) X.fillRect(x, 0, 36, h);
  X.fillStyle = 'rgba(255,120,150,.4)'; for (let y = 38; y < 290; y += 48) for (let x = 36 + (y / 48 & 1) * 36; x < w; x += 72) { X.beginPath(); X.arc(x, y, 5, 0, 7); X.fill(); }
  X.fillStyle = '#c4874e'; X.fillRect(0, 0, w, 14); X.fillStyle = '#e8b06a'; X.fillRect(0, 14, w, 5);
  X.fillStyle = '#b97a46'; X.fillRect(0, 306, w, 64);
  for (let x = 6; x < w; x += 80) { rr(x, 318, 68, 38, 6); X.fillStyle = '#a5622c'; X.fill(); X.strokeStyle = '#8a5530'; X.lineWidth = 3; X.stroke(); }
  rr(-10, 294, w + 20, 14, 3); ink('#f2c14a', 3);
  X.fillStyle = '#3b2314'; X.fillRect(0, 358, w, 12);
  X.save(); X.translate(385, 322); X.rotate(.35);
  X.beginPath(); X.arc(-26, 4, 40, -1.1, .95); X.lineCap = 'round'; X.strokeStyle = INK; X.lineWidth = 31; X.stroke(); X.strokeStyle = '#ffe14d'; X.lineWidth = 22; X.stroke();
  X.beginPath(); X.arc(-26, 4, 34, -.9, .1); X.strokeStyle = 'rgba(255,255,255,.55)'; X.lineWidth = 5; X.stroke();
  X.beginPath(); X.arc(-26, 4, 46, .6, .95); X.strokeStyle = '#9a6a2a'; X.lineWidth = 9; X.stroke();
  rr(-30, -12, 18, 46, 3); X.fillStyle = 'rgba(205,210,220,.92)'; X.fill(); X.strokeStyle = '#8f98a8'; X.lineWidth = 2; X.stroke();
  X.restore();
});
reg3('td_cube', sp => {
  _td3.init();
  const S = T3.scene({ bg: 0x6a3a58, cam: [0, 1.2, 8.4], look: [0, .1, 0], fov: 45, ground: 0xffffff, sun: [4, 10, 8] });
  S.floor.position.y = -3.2;
  /* the gallery: checkered marble, wallpapered wall, a roped-off gold pad under a spotlight */
  S.floor.material.map = cvTex('cubeFloor', 64, 64, () => { X.fillStyle = '#f7e3cf'; X.fillRect(0, 0, 64, 64); X.fillStyle = '#e4a6a0'; X.fillRect(0, 0, 32, 32); X.fillRect(32, 32, 32, 32); }, [40, 40]);
  const beam = quiet(() => {
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(44, 15), new THREE.MeshBasicMaterial({ map: cubeWallTex() })); wall.position.set(0, 4.3, -6); S.scene.add(wall);
  T3.cyl(S, 3.5, 3.5, .14, 0xf2c14a, [0, -3.13, 0], null, 1.03).castShadow = false;
  T3.cyl(S, 3.05, 3.05, .2, 0xd9434f, [0, -3.1, 0], null, 1.02).castShadow = false;
  for (const sx of [-1, 1]) {
    T3.cyl(S, .5, .55, .14, 0xf2c14a, [sx * 4.7, -3.1, -1.5]); T3.cyl(S, .12, .12, 1.6, 0xf2c14a, [sx * 4.7, -2.3, -1.5]); T3.sphere(S, .26, 0xf2c14a, [sx * 4.7, -1.4, -1.5]);
  }
  T3.cyl(S, .09, .09, 9.4, 0xd9434f, [0, -1.75, -1.5], [0, 0, Math.PI / 2]);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.7, 3.6, 10, 28, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: .08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  beam.position.set(0, 1.8, 0); beam.renderOrder = 2; S.scene.add(beam);
  return beam;
  });
  const tex = _cubeTextures();
  const mkCube = (size, pos) => {
    const m = T3.box(S, size, size, size, 0xffffff, pos);
    const old = m.material; m.material = tex.map(t => new THREE.MeshLambertMaterial({ map: t })); old.dispose();
    return m;
  };
  const cube = mkCube(3, [0, 0, 0]);
  const tgt = mkCube(1.25, [-5.1, 2.55, 1.2]);
  // the 24 axis-aligned orientations
  const ORI = [new THREE.Quaternion()];
  const gens = [new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)];
  for (let i = 0; i < ORI.length; i++) for (const gq of gens) {
    const n = gq.clone().multiply(ORI[i]);
    if (!ORI.some(o => Math.abs(o.dot(n)) > .999)) ORI.push(n);
  }
  const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), tmp = new THREE.Quaternion();
  const turn = (ax, ang) => new THREE.Quaternion().setFromAxisAngle(ax, ang);
  const target = ORI[Math.floor(Math.random() * 24)].clone();
  const q = target.clone(), goal = target.clone();
  const moves = [turn(AX, Math.PI / 2), turn(AX, -Math.PI / 2), turn(AY, Math.PI / 2), turn(AY, -Math.PI / 2)];
  const nMoves = 2 + (sp > 1.35) + (sp > 1.8);
  for (let tries = 0; tries < 20; tries++) {
    q.copy(target);
    for (let k = 0; k < nMoves; k++) q.premultiply(moves[Math.floor(Math.random() * 4)]);
    if (q.angleTo(target) > 1) break;
  }
  goal.copy(q);
  tgt.quaternion.copy(target); tgt.scale.setScalar(.6);
  toonify(S, .62, .85);
  const TOL = .45 - .06 * (sp - 1), TEND = 7 / Math.sqrt(sp);
  let drag = false, lx = 0, ly = 0, holdT = 0, pulse = 0, matched = false, ang = 9, ot = 0, dpx = 400, dpy = 300;
  const snap = () => { let b = 0, bd = -1; for (let i = 0; i < 24; i++) { const d = Math.abs(ORI[i].dot(q)); if (d > bd) { bd = d; b = i; } } goal.copy(ORI[b]); if (goal.dot(q) < 0) { goal.x *= -1; goal.y *= -1; goal.z *= -1; goal.w *= -1; } };
  /* Sir Potato, the portrait that watches the cube */
  const potato = (x, y, mood, lx2, ly2, T) => {
    rr(x - 62, y - 80, 124, 152, 12); ink('#f2c14a', 5); rr(x - 52, y - 70, 104, 132, 6); X.fillStyle = '#7a3b4a'; X.fill(); X.strokeStyle = '#c4902a'; X.lineWidth = 3; X.stroke();
    cel(() => { X.beginPath(); X.moveTo(x - 46, y + 62); X.quadraticCurveTo(x - 40, y + 20, x, y + 20); X.quadraticCurveTo(x + 40, y + 20, x + 46, y + 62); X.closePath(); }, '#2f4a7a', '#22365c', -6, 0, 3);
    cel(() => { el(x - 26, y - 20, 17, 22, -.3); X.moveTo(x + 43, y - 20); X.ellipse(x + 26, y - 20, 17, 22, .3, 0, 7); }, '#fff', '#c9d0e8', -3, -3, 3);
    cel(() => el(x, y - 4, 31, 40), '#d6a66a', '#b07f45', -6, -6, 4);
    glint(x - 11, y - 24, 8, 4, -.5, .5);
    X.fillStyle = '#b07f45'; for (const [fx, fy] of [[-14, 6], [12, 10], [4, -12], [-6, 20]]) { el(x + fx, y + fy, 2.4, 1.8); X.fill(); }
    cel(() => { X.beginPath(); X.moveTo(x - 20, y + 24); X.lineTo(x, y + 36); X.lineTo(x + 20, y + 24); X.lineTo(x + 14, y + 44); X.lineTo(x, y + 34); X.lineTo(x - 14, y + 44); X.closePath(); }, '#fff', '#c9d0e8', -2, -3, 2.5);
    X.save(); X.translate(x, y - 6); X.scale(.34, .34); const sc = X.canvas ? 1 : 1;
    X.fillStyle = 'rgba(255,110,140,.5)'; for (const s of [-1, 1]) { el(s * 72, 38, 14, 8); X.fill(); }
    for (const s of [-1, 1]) eyeP(s * 50, -14, 22, mood, lx2, ly2, 0, T, 3);
    X.strokeStyle = INK; X.lineWidth = 12; X.lineCap = 'round';
    if (mood === 'happy' || mood === 'eager') { X.beginPath(); X.moveTo(-26, 44); X.quadraticCurveTo(0, mood === 'happy' ? 70 : 58, 26, 44); X.stroke(); }
    else if (mood === 'dizzy') { el(0, 52, 12, 14); ink('#6a1f33', 6); el(0, 62, 8, 6); X.fillStyle = '#ff7a95'; X.fill(); }
    else { X.beginPath(); X.moveTo(-22, 50); X.lineTo(22, 50); X.stroke(); }
    X.restore();
  };
  const g = {
    wide: true, cmd: 'MATCH!', hint: 'DRAG OR ARROWS: COPY THE TARGET', thint: 'DRAG THE CUBE TO MATCH', dur: 7,
    key(e) {
      if (g.result || drag) return;
      let m = null;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') m = 3; else if (e.code === 'ArrowRight' || e.code === 'KeyD') m = 2;
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') m = 1; else if (e.code === 'ArrowDown' || e.code === 'KeyS') m = 0;
      if (m == null) return;
      goal.premultiply(moves[m]); sfx.click(); sfx.whoosh(true); pulse = 1;
    },
    down(p) { if (g.result) return; drag = true; lx = p.x; ly = p.y; dpx = p.x; dpy = p.y; goal.copy(q); sfx.tick(); },
    move(p) {
      if (!drag || g.result) return;
      dpx = p.x; dpy = p.y;
      const dx = p.x - lx, dy = p.y - ly; lx = p.x; ly = p.y;
      tmp.setFromAxisAngle(AY, dx * .012); q.premultiply(tmp);
      tmp.setFromAxisAngle(AX, dy * .012); q.premultiply(tmp);
      q.normalize(); goal.copy(q);
    },
    up() { if (!drag) return; drag = false; snap(); sfx.click(); pulse = .6; },
    update(dt, t) {
      S.t = t; if (g.result) ot += dt;
      beam.material.opacity = g.result === 'win' ? .18 + .06 * Math.sin(ot * 16) : g.result === 'lose' ? .03 : matched ? .16 : .08;
      beam.material.color.setHex(g.result === 'win' ? 0xffe98a : g.result === 'lose' ? 0xff9a9a : matched ? 0xc9ffd0 : 0xfff6c0);
      if (!drag) q.slerp(goal, 1 - Math.exp(-14 * dt));
      cube.quaternion.copy(q);
      cube.position.y = Math.sin(t * 2.2) * .12;
      pulse = Math.max(0, pulse - dt * 4); const sc = 1 + pulse * .08 + (g.result === 'win' ? Math.sin(t * 18) * .04 : 0); cube.scale.setScalar(sc);
      tgt.position.x = -(Math.tan(.3927) * 7.2 * VW / H - 1.7);   // pinned to the top-left of the visible area at any width
      tgt.position.y = 1.5 + Math.sin(t * 2.2 + 1) * .08;
      if (g.result) return;
      ang = q.angleTo(target);
      const m = ang < TOL;
      if (m && !matched) { sfx.blip(7); ring(W / 2, H / 2, '#7dff7a', 150, .35); }
      if (!m && matched) sfx.tick();
      matched = m;
      if (m) {
        holdT += dt;
        if (holdT >= .3) {
          g.result = 'win'; sfx.sparkle(); sfx.coin(); confetti(W / 2, H / 2, 50); shake(6, .25);
          burst(W / 2, H / 2, '#7dff7a', 24, 380); floatText('PERFECT!', W / 2, 120, '#FFE14D', 46);
          q.copy(target); goal.copy(target); drag = false;
        }
      } else holdT = Math.max(0, holdT - dt * 2);
    },
    draw(t) {
      X = ctx; _td3.render(S);
      const win = g.result === 'win', lose = g.result === 'lose', R = W + OX;
      const c = _td3.scr(S, 0, cube.position.y, 0);
      if (matched || win) {
        X.beginPath(); X.arc(c.x, c.y, 226, 0, 7); X.lineWidth = 20; X.strokeStyle = 'rgba(20,16,28,.45)'; X.stroke();
        X.beginPath(); X.arc(c.x, c.y, 226, 0, 7); X.lineWidth = 9; X.strokeStyle = '#7dff7a'; X.globalAlpha = .6 + .3 * Math.sin(t * 20); X.stroke(); X.globalAlpha = 1;
      }
      // the target, hung in a gilded frame on two strings
      const tp = _td3.scr(S, tgt.position.x, 1.5, 1.2);
      X.beginPath(); X.moveTo(tp.x - 64, tp.y - 80); X.lineTo(tp.x, tp.y - 104); X.lineTo(tp.x + 64, tp.y - 80); X.strokeStyle = '#e6c58c'; X.lineWidth = 3; X.stroke();
      X.beginPath(); X.arc(tp.x, tp.y - 106, 6, 0, 7); ink('#c4902a', 2.5);
      X.save(); rr(tp.x - 78, tp.y - 74, 156, 168, 6); X.fillStyle = 'rgba(255,255,255,.28)'; X.fill();
      rr(tp.x - 90, tp.y - 86, 180, 192, 12); rr(tp.x - 78, tp.y - 74, 156, 168, 6, 1); X.lineWidth = 8; X.lineJoin = 'round'; X.strokeStyle = INK; X.stroke();
      rr(tp.x - 90, tp.y - 86, 180, 192, 12); rr(tp.x - 78, tp.y - 74, 156, 168, 6, 1); X.fillStyle = '#f2c14a'; X.fill('evenodd');
      glint(tp.x - 60, tp.y - 80, 40, 3, 0, .5); X.restore();
      pill(tp.x, tp.y + 98, 'TARGET', '#FFE14D', false);
      // Sir Potato, the portrait that follows the cube with its eyes
      const pxp = R - 88, pyp = 218;
      const pm = win ? 'happy' : lose ? 'dizzy' : matched ? 'eager' : (!win && t > TEND - 1.5) ? 'panic' : 'idle';
      const tx = drag ? dpx : c.x, ty = drag ? dpy : c.y;
      potato(pxp, pyp, pm === 'panic' ? 'panic' : pm, clp((tx - pxp) / 220, -1, 1), clp((ty - pyp) / 220, -1, 1), t);
      if (win) for (let i = 0; i < 3; i++) { const f = (ot * 1.2 + i / 3) % 1; heart(pxp - 30 + i * 30 + Math.sin(f * 6 + i) * 6, pyp - 90 - f * 50, 8 + (1 - f) * 3, '#ff5c8a'); }
      // the curator
      const hx = R - 78, hy = 520, panic = !win && !lose && t > TEND - 1.5 && !matched;
      const mood = win ? 'happy' : lose ? 'sad' : panic ? 'panic' : (drag || matched || holdT > 0) ? 'eager' : 'idle';
      const lift = win ? Math.abs(Math.sin(ot * 9)) * 18 : 0;
      const up = win ? [[-1.4, -3.4], [1.4, -3.4]] : lose ? [[-1, 3.4], [1, 3.4]] : (drag || matched) ? [[-2.2, -1.2], [2.2, -1.2]] : [[-1.2, 3.2], [1.2, 3.2]];
      hero2d(hx, hy, 6, mood, -1, -.1, { al: up[0], ar: up[1], lift, k: 1 });
      X.save(); X.translate(0, -lift); el(hx, hy - 9.2 * 6, 35, 9.6, -.08); ink('#c93a4a', 3); el(hx - 8, hy - 9.6 * 6, 14, 3, -.2); X.fillStyle = 'rgba(255,255,255,.3)'; X.fill(); X.beginPath(); X.arc(hx + 2, hy - 9.9 * 6 - 8, 4.5, 0, 7); ink('#c93a4a', 2.5); X.restore();
      if (panic) { sweat(hx - 46, hy - 70 - lift, 5, t, 0); sweat(hx + 44, hy - 66 - lift, 4, t, .5); }
      if (lose) for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; spark(c.x + Math.cos(a) * 150, c.y - 150 + Math.sin(a) * 24, 11, a, '#FFE14D'); }
      if (win) { const k = outBack(ot / .3); X.save(); X.translate(c.x + 170, c.y - 150); X.scale(k, k); X.rotate(.15); tube(-18, 18, -26, 52, 12, '#d9434f'); tube(18, 18, 26, 52, 12, '#d9434f'); X.beginPath(); X.arc(0, 0, 40, 0, 7); ink('#FFE14D', 4); X.beginPath(); X.arc(0, 0, 28, 0, 7); X.strokeStyle = '#c4902a'; X.lineWidth = 3; X.stroke(); X.restore(); star(c.x + 170, c.y - 150, 17, 7, 5, ot * 3, '#fff3a0', 3); }
      // hold bar: the judges' meter
      const k = Math.min(1, holdT / .3);
      rr(W / 2 - 108, 518, 216, 32, 16); ink('#2b2440', 4);
      if (k > 0) { rr(W / 2 - 100, 525, Math.max(14, 200 * k), 18, 9); X.fillStyle = '#7dff7a'; X.fill(); glint(W / 2 - 80, 530, 30 * k + 4, 3, 0, .6); }
      star(W / 2 + 120, 534, 15, 7, 5, t * .8, k >= 1 ? '#FFE14D' : '#6e6890', 3);
      if (!g.result && !drag && t < 2.2) txt(TOUCH ? 'DRAG ME' : 'DRAG / ARROWS', W / 2, 470, 28, '#fff', 'center', 300);
      vignette(.22);
    },
  };
  return g;
}, 'Cube Match');

/* ───────────── 2. LANE RUNNER: the road to the finish ───────────── */
/* baked sky + mountains + hills (background texture; the 3D road fades into the same horizon colour) */
const lanesSkyTex = () => cvTex('lanesSky' + VW, VW, 600, () => {
  const w = VW, g = X.createLinearGradient(0, 0, 0, 152); g.addColorStop(0, '#36b0ea'); g.addColorStop(.62, '#86d8fb'); g.addColorStop(1, '#d6f7ff'); X.fillStyle = g; X.fillRect(0, 0, w, 152);
  X.fillStyle = '#d6f7ff'; X.fillRect(0, 152, w, 448);
  const sx = w * .2, sy = 100; for (const [r, a] of [[78, .1], [60, .14], [46, .2]]) { X.beginPath(); X.arc(sx, sy, r, 0, 7); X.fillStyle = 'rgba(255,248,200,' + a + ')'; X.fill(); }
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; X.beginPath(); X.moveTo(sx + Math.cos(a) * 40, sy + Math.sin(a) * 40); X.lineTo(sx + Math.cos(a + .13) * 72, sy + Math.sin(a + .13) * 72); X.lineTo(sx + Math.cos(a - .13) * 72, sy + Math.sin(a - .13) * 72); X.closePath(); X.fillStyle = 'rgba(255,240,150,.45)'; X.fill(); }
  X.beginPath(); X.arc(sx, sy, 28, 0, 7); ink('#ffe14d', 4); glint(sx - 8, sy - 9, 10, 6, -.5, .6);
  const range = (base, pk, fill, ol, snow, seed) => {
    X.beginPath(); X.moveTo(0, 160); let x = 0, i = 0; const pts = [];
    while (x <= w + 60) { const h = pk * (.55 + .45 * Math.abs(Math.sin(i * 1.9 + seed))); pts.push([x, base - h]); X.lineTo(x, base - h); x += 70 + 40 * Math.abs(Math.sin(i * 2.7 + seed)); X.lineTo(x - 35, base - h * .25); i++; }
    X.lineTo(w + 80, 160); X.closePath(); X.lineJoin = 'round'; X.lineWidth = 3; X.strokeStyle = ol; X.stroke(); X.fillStyle = fill; X.fill();
    if (snow) for (const [px, py] of pts) { X.beginPath(); X.moveTo(px, py); X.lineTo(px - 14, py + 17); X.lineTo(px - 5, py + 14); X.lineTo(px, py + 20); X.lineTo(px + 6, py + 14); X.lineTo(px + 14, py + 17); X.closePath(); X.fillStyle = '#f6f8ff'; X.fill(); }
  };
  range(152, 70, '#c9d0fb', '#7b80c6', true, 1); range(154, 44, '#a4b1f2', '#5b5fa8', true, 4);
  X.beginPath(); X.moveTo(0, 160); for (let x = 0; x <= w; x += 20) X.lineTo(x, 138 + 10 * Math.sin(x * .011) + 5 * Math.sin(x * .037)); X.lineTo(w, 160); X.closePath(); X.fillStyle = '#a9dfc6'; X.fill();
  for (let i = 0; i < 9; i++) { const x = 40 + i * w / 9 + (i * 37 % 29), y = 143 + 10 * Math.sin(x * .011) + 5 * Math.sin(x * .037); X.fillStyle = '#7fbf9d'; X.fillRect(x - 1.5, y - 7, 3, 8); X.beginPath(); X.arc(x, y - 11, 6, 0, 7); X.fill(); }
});
const lanesGrassTex = () => cvTex('lanesGrass', 16, 64, () => { X.fillStyle = '#7ccf5a'; X.fillRect(0, 0, 16, 64); X.fillStyle = '#6fc24f'; X.fillRect(0, 0, 16, 32); }, [1, 60]);
const crateTex = () => cvTex('crate', 64, 64, () => { X.fillStyle = '#e8a64f'; X.fillRect(0, 0, 64, 64); X.strokeStyle = '#a5622c'; X.lineWidth = 6; X.strokeRect(3, 3, 58, 58); X.lineWidth = 5; X.beginPath(); X.moveTo(6, 6); X.lineTo(58, 58); X.moveTo(58, 6); X.lineTo(6, 58); X.stroke(); X.fillStyle = 'rgba(255,255,255,.25)'; X.fillRect(8, 8, 48, 4); });
const grumpyTex = () => cvTex('grumpy', 128, 80, () => {
  for (const s of [-1, 1]) { el(64 + s * 28, 38, 16, 17); ink('#fff', 3.5); X.beginPath(); X.arc(64 + s * 25, 43, 7, 0, 7); X.fillStyle = INK; X.fill(); X.beginPath(); X.moveTo(64 + s * 46, 12); X.lineTo(64 + s * 10, 26); X.strokeStyle = INK; X.lineWidth = 8; X.lineCap = 'round'; X.stroke(); }
  X.beginPath(); X.moveTo(40, 70); X.quadraticCurveTo(64, 54, 88, 70); X.lineWidth = 6; X.strokeStyle = INK; X.stroke();
});
const checkerTex = () => cvTex('checker', 256, 32, () => { for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { X.fillStyle = (i + j) % 2 ? INK : '#fff'; X.fillRect(i * 16, j * 16, 16, 16); } });
const blimpTex = () => cvTex('blimp', 256, 160, () => {
  X.translate(0, -6);
  cel(() => el(128, 66, 104, 52), '#ff5c8a', '#c9335f', -10, -9, 5);
  X.save(); el(128, 66, 104, 52); X.clip(); for (let i = -3; i < 4; i++) { X.fillStyle = 'rgba(255,255,255,.55)'; X.beginPath(); X.moveTo(128 + i * 34 - 8, 10); X.lineTo(128 + i * 34 + 8, 10); X.lineTo(128 + i * 40 + 8, 130); X.lineTo(128 + i * 40 - 8, 130); X.fill(); } X.restore();
  glint(92, 40, 30, 8, -.3, .5);
  tube(100, 112, 112, 134, 3, '#e6c58c'); tube(156, 112, 144, 134, 3, '#e6c58c');
  rr(106, 130, 44, 24, 5); ink('#d9944f', 4); X.fillStyle = OR; X.fillRect(120, 118, 16, 12); X.fillStyle = INK; X.fillRect(123, 122, 3, 5); X.fillRect(131, 122, 3, 5);
});
reg3('td_lanes', sp => {
  _td3.init();
  const S = T3.scene({ bg: 0xd6f7ff, fog: [28, 85], cam: [0, 4.6, 7.4], look: [0, 1.2, -9], ground: 0xffffff, sun: [6, 14, 4] });
  S.scene.background = lanesSkyTex(); S.scene.fog.color.setHex(0xd6f7ff);
  S.floor.scale.set(4, 4, 1); S.floor.material.map = lanesGrassTex(); lanesGrassTex().offset.set(0, 0);
  const road = T3.box(S, 10, .2, 150, 0x6f6a8a, [0, .02, -55]); road.castShadow = false;
  T3.box(S, .5, .35, 150, 0xffffff, [-5.2, .1, -55]).castShadow = false;
  T3.box(S, .5, .35, 150, 0xffffff, [5.2, .1, -55]).castShadow = false;
  const LOOP = 96;
  const stripes = [];
  for (let i = 0; i < 12; i++) for (const sx of [-1.5, 1.5]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(.22, .03, 2.6), new THREE.MeshBasicMaterial({ color: 0xfff3a8 }));
    s.position.set(sx, .14, 10 - i * 8); S.scene.add(s); stripes.push(s);
  }
  const curbs = [];
  quiet(() => { const curbG = new THREE.BoxGeometry(.56, .38, 2), curbM = new THREE.MeshBasicMaterial({ color: 0xe8434f });
    for (let i = 0; i < 24; i++) for (const sx of [-5.2, 5.2]) { const c = new THREE.Mesh(curbG, curbM); c.position.set(sx, .12, 10 - i * 4); S.scene.add(c); curbs.push(c); } });
  const trees = [];
  for (let i = 0; i < 32; i++) {
    const side = i % 2 ? 1 : -1, tr = new THREE.Group(), M = T3.mk;
    const trunk = M.cyl(.3, .4, 1.2, 0x8a5a3c); trunk.position.y = .6; tr.add(trunk);
    if (i % 4 === 2) {   // lollipop tree
      const b1 = M.sphere(1.6, i % 3 ? 0x3fb260 : 0x2f9a55); b1.position.y = 2.9; tr.add(b1);
      const b2 = M.sphere(.9, 0x5bcf72, 1.1); b2.position.set(-.7, 3.5, .9); tr.add(b2);
    } else {
      const c1 = M.cone(1.5, 2.4, i % 3 ? 0x3fb64f : 0x2e9e6a); c1.position.y = 2.2; tr.add(c1);
      const c2 = M.cone(1.1, 1.8, i % 3 ? 0x4ccb5c : 0x3bb57e); c2.position.y = 3.4; tr.add(c2);
    }
    // i >= 16: outer rows that only widescreens ever see
    T3.add(S, tr, i < 16 ? [side * (7.5 + (i * 7 % 5)), 0, 10 - Math.floor(i / 2) * 12] : [side * (15 + (i * 7 % 11)), 0, 4 - Math.floor((i - 16) / 2) * 12]); trees.push(tr);
  }
  // obstacle pool: each holds boulder / barrel / crate children
  const pool = [];
  for (let i = 0; i < 12; i++) {
    const o = new THREE.Group(), M = T3.mk;
    const boulder = M.sphere(.95, 0x9a8fb0); boulder.position.y = .95;
    const bump = M.sphere(.35, 0x8277a0); bump.position.set(.55, .7, .65); boulder.add(bump); o.add(boulder);
    const barrel = M.cyl(.7, .7, 1.4, 0xd9633c); barrel.position.y = .7;
    const band = M.cyl(.74, .74, .2, 0xffd23f, 1.1); band.position.y = .35; barrel.add(band);
    const band2 = M.cyl(.74, .74, .2, 0xffd23f, 1.1); band2.position.y = -.35; barrel.add(band2);
    barrel.rotation.z = Math.PI / 2; const bg2 = new THREE.Group(); bg2.add(barrel); barrel.position.y = 0; bg2.position.y = .7; o.add(bg2);
    const crate = M.box(1.5, .9, 1.5, 0xffffff); crate.material.map = crateTex(); crate.position.y = .45; o.add(crate);
    const gt = grumpyTex(), face = quiet(() => { const f = new THREE.Mesh(new THREE.PlaneGeometry(1.3, .8), new THREE.MeshBasicMaterial({ map: gt, transparent: true, depthWrite: false })); f.position.set(0, 1.05, .98); o.add(f); return f; });
    T3.add(S, o, [0, 0, 50]); o.visible = false;
    pool.push({ o, parts: [boulder, bg2, crate], face, kind: 0, x: 0, z: 0, on: false });
  }
  const cl = hero3(S, .5, [0, 0, 0], 0); cl.rotation.y = Math.PI;
  quiet(() => { const pk = T3.mk.box(1.5, 1.2, .55, 0x4d96ff); pk.position.set(0, 1.7, -1.25); cl.add(pk); for (const sx of [-.7, .7]) { const sr = T3.mk.box(.18, 1.5, .16, 0xffd23f, 1.1); sr.position.set(sx, 1.65, -.93); cl.add(sr); } });
  const v0 = 17 + 5 * (sp - 1), spacing = 13 - 1.2 * (sp - 1), TEND = 7 / Math.sqrt(sp);
  let lane = 0, cx = 0, y = 0, vy = 0, acc = 0, v = v0, rt = 0, shakeV = 0, hitT = 0, passN = 0, ot = 0, tNow = 0;
  /* the finish arch: arrives overhead exactly when the timer ends (decor only) */
  const arch = quiet(() => {
    const a = new THREE.Group(), AM = T3.mk;
    for (const sx of [-1, 1]) { const p = AM.cyl(.35, .4, 5.6, 0xe8434f); p.position.set(sx * 5.9, 2.8, 0); a.add(p); }
    const beamA = AM.box(12.6, 1.5, .5, 0xffffff); beamA.position.set(0, 5.6, 0); a.add(beamA);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(12.2, 1.1), new THREE.MeshBasicMaterial({ map: checkerTex(), transparent: false })); flag.position.set(0, 5.6, .27); a.add(flag);
    T3.add(S, a, [0, 0, 1 - v0 * TEND]); return a;
  });
  /* sky layer: drifting clouds + a blimp with a Claude in the basket */
  const skyCl = [[-60, 15, 30], [-5, 19, 24], [48, 13, 34], [20, 23, 22]].map(([x, yy, w]) => sprite(S, cloudTex(), w, w / 2, [x, yy, -96]));
  const blimp = sprite(S, blimpTex(), 14, 8.75, [-30, 9, -88]);
  const spawnRow = z => {
    const free = Math.floor(Math.random() * 3), r = Math.random();
    const lanes = r < .14 ? [0, 1, 2] : (r < .14 + .4 * Math.min(1, sp - .3) ? [0, 1, 2].filter(i => i !== free) : [free === 1 ? 0 : 1]);
    const allCrate = lanes.length === 3;
    for (const li of lanes) {
      const p = pool.find(q => !q.on); if (!p) return;
      p.on = true; p.kind = allCrate ? 2 : Math.floor(Math.random() * 3); p.x = (li - 1) * 3; p.z = z; p.o.visible = true;
      p.parts.forEach((m, i) => m.visible = i === p.kind); p.face.visible = p.kind === 0;
      p.o.position.set(p.x, 0, z); p.o.rotation.set(0, 0, 0);
      p.parts[0].rotation.set(0, 0, 0); p.parts[1].rotation.set(0, 0, 0);
    }
  };
  for (let z = -26; z > -62; z -= spacing) spawnRow(z);
  toonify(S, .62, .85);
  const jump = () => { if (y <= 0 && !g.result) { vy = 9.2; sfx.boing(); sfx.whoosh(true); } };
  const go = d => { const n = _td3.cl(lane + d, -1, 1); if (n !== lane && !g.result) { lane = n; sfx.whoosh(d > 0); shakeV = .06; } };
  const g = {
    wide: true, cmd: 'RUN!', hint: 'ARROWS / A D: DODGE · SPACE: JUMP', thint: 'TAP SIDES: DODGE · TAP MIDDLE: JUMP', dur: 7, timeWin: true,
    key(e) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') go(-1);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') go(1);
      else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') jump();
    },
    down(p) { if (p.x < W * .36) go(-1); else if (p.x > W * .64) go(1); else jump(); },
    update(dt, t) {
      S.t = t; rt += dt; tNow = t; if (g.result) ot += dt;
      if (g.result === 'lose') {   // knocked back toward the camera in one somersault, landing dizzy and facing us
        hitT += dt; v *= Math.max(0, 1 - 6 * dt); const hk = clp(hitT / .6, 0, 1);
        cl.rotation.x = hk * Math.PI * 2; cl.rotation.y += (0 - cl.rotation.y) * Math.min(1, 7 * dt); cl.rotation.z = 0;
        y = Math.max(0, 2.2 * Math.sin(hk * Math.PI)); cl.position.y = y; cl.position.z = ease(hk) * 1.1; cl.position.x = cx + (lane > 0 ? -1 : 1) * ease(hk) * 2.4; shakeV *= .9;
      }
      const mv = v * dt;
      for (const s of stripes) { s.position.z += mv; if (s.position.z > 12) s.position.z -= LOOP; }
      for (const c of curbs) { c.position.z += mv; if (c.position.z > 12) c.position.z -= LOOP; }
      for (const tr of trees) { tr.position.z += mv; if (tr.position.z > 12) tr.position.z -= LOOP; }
      arch.position.z += mv; arch.visible = arch.position.z < 14;
      lanesGrassTex().offset.y -= mv / 8;
      skyCl.forEach((c, i) => { c.position.x += dt * (1.1 + i * .35); if (c.position.x > 95) c.position.x = -95; });
      blimp.position.x += dt * 1.6; blimp.position.y = 9 + Math.sin(rt * .8) * .4; if (blimp.position.x > 90) blimp.position.x = -90;
      acc += mv;
      if (acc >= spacing && !g.result) { acc -= spacing; spawnRow(-60 + acc); }
      for (const p of pool) if (p.on) {
        p.z += mv; p.o.position.z = p.z;
        if (p.kind === 0) p.parts[0].rotation.x -= mv / .95; else if (p.kind === 1) p.parts[1].rotation.x -= mv / .7;
        if (g.result === 'win' && p.z > -5) p.o.visible = false;   // clear the road for the victory pose
        if (p.z > 6) { p.on = false; p.o.visible = false; if (!g.result) passN++; }
        else if (!g.result && p.z > -1.05 && p.z < 1.05 && Math.abs(p.x - cx) < 1.2 && !(p.kind === 2 && y > .8)) {
          g.result = 'lose'; hitT = 0; sfx.thud(); sfx.buzz(); shake(12, .4); shakeV = .5;
          const sp2 = _td3.scr(S, cx, 1.2, 0);
          burst(sp2.x, sp2.y, '#FFE14D', 22, 360); ring(sp2.x, sp2.y, '#fff', 130, .45); floatText('OUCH!', clp(sp2.x + (lane > 0 ? -1 : 1) * 190, 90, W - 90), sp2.y - 30, '#ff6a5a', 44);
        }
      }
      if (!g.result) {
        cx += (lane * 3 - cx) * Math.min(1, 14 * dt);
        vy -= 30 * dt; y += vy * dt; if (y <= 0) { if (vy < -4 && y < 0) { snd(150, .08, 'sine', .08, 0, 70); } y = 0; vy = 0; }
        const run = y <= 0;
        cl.position.set(cx, y + (run ? Math.abs(Math.sin(rt * 14)) * .1 : 0), 0);
        cl.rotation.z = -(lane * 3 - cx) * .1;
        cl.legs.forEach((l, i) => { l.rotation.x = run ? Math.sin(rt * 16 + i * 1.6) * .9 : .5; });
        cl.armL.position.y = 1.45 + (run ? Math.sin(rt * 16) * .15 : .4); cl.armR.position.y = 1.45 + (run ? -Math.sin(rt * 16) * .15 : .4);
      } else if (g.result === 'win') {   // turns round under the finish arch, arms up
        cl.rotation.y += (0 - cl.rotation.y) * Math.min(1, 9 * dt); cl.rotation.z = 0; cl.position.set(cx, Math.abs(Math.sin(ot * 9)) * .6, 0);
        cl.armL.position.y = cl.armR.position.y = 2.15 + Math.sin(ot * 20) * .15; cl.legs.forEach((l, i) => { l.rotation.x = Math.sin(ot * 18 + i) * .3; });
      }
      setFace(cl, g.result === 'win' ? 'happy' : g.result === 'lose' ? 'dizzy' : 'eager', 0, 0);
      shakeV *= Math.max(0, 1 - 8 * dt);
      const cam = S.camera;
      cam.position.x += (cx * .55 - cam.position.x) * Math.min(1, 6 * dt);
      cam.position.y = 4.6 + Math.sin(rt * 14) * .04 + y * .3;
      cam.position.z = 7.4;
      if (shakeV > .01) T3.shakeCam(S, shakeV);
      cam.lookAt(cam.position.x * .6, 1.2, -9);
    },
    draw(t) {
      X = ctx; _td3.render(S);
      const win = g.result === 'win', lose = g.result === 'lose';
      // speed lines
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a = i * .83 + 1, r = 280 + ((now * 400 + i * 97) % 200), r2 = r + 40, kx = 1.2 * VW / W;
        ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * r * kx, 240 + Math.sin(a) * r * .8); ctx.lineTo(W / 2 + Math.cos(a) * r2 * kx, 240 + Math.sin(a) * r2 * .8); ctx.stroke();
      }
      // progress: the road map to the finish
      const pw = 250, px0 = W / 2 - pw / 2, k = clp(tNow / TEND, 0, 1);
      rr(px0, 62, pw, 22, 11); ink('#2b2440', 3.5);
      rr(px0 + 5, 67, Math.max(12, (pw - 10) * k), 12, 6); X.fillStyle = '#5CFF7A'; X.fill();
      for (let i = 1; i < 5; i++) { X.beginPath(); X.arc(px0 + pw * i / 5, 73, 2.2, 0, 7); X.fillStyle = 'rgba(255,255,255,.55)'; X.fill(); }
      rr(px0 + pw - 6, 56, 6, 34, 2); ink('#fff', 2); rr(px0 + pw - 2, 54, 22, 14, 2); ink('#14101c', 2); X.fillStyle = '#fff'; X.fillRect(px0 + pw + 4, 54, 8, 7);
      claude(px0 + 5 + (pw - 10) * k, 71, 1.5, { col: OR, mood: win ? 'happy' : lose ? 'sad' : 'none' });
      const cp = _td3.scr(S, cl.position.x, 1.2 + y, cl.position.z);
      if (lose) for (let i = 0; i < 3; i++) { const a = rt * 6 + i * 2.1; spark(cp.x + Math.cos(a) * 80, cp.y - 70 + Math.sin(a) * 14, 11, a, '#FFE14D'); }
      if (win) for (let i = 0; i < 4; i++) { const f = (ot * 1.4 + i / 4) % 1; heart(cp.x - 60 + i * 40 + Math.sin(f * 7 + i) * 8, cp.y - 40 - f * 90, 9 + (1 - f) * 3, '#ff5c8a'); }
      if (TOUCH && !g.result && t < 2) {
        ctx.globalAlpha = .55;
        for (const [px, lab] of [[90 - OX, '<'], [W + OX - 90, '>'], [W / 2, '^']]) { plate(px - 46, H / 2 - 44, 92, 70, '#ffd23f', '#c99512', false); txt(lab, px, H / 2 + 2, 56, INK); }
        ctx.globalAlpha = 1;
      }
      vignette(.22);
    },
  };
  return g;
}, 'Lane Run');

/* ───────────── 3. CLAW MACHINE: the arcade at night ───────────── */
const carpetTex = () => cvTex('carpet', 128, 128, () => {
  X.fillStyle = '#2d1b69'; X.fillRect(0, 0, 128, 128); X.lineCap = 'round'; X.lineWidth = 5;
  for (const [cx2, cy2, col] of [[32, 32, '#38e1ff'], [96, 96, '#ff5c8a'], [96, 32, '#ffd23f'], [32, 96, '#5CFF7A']]) { X.strokeStyle = col; X.beginPath(); X.moveTo(cx2 - 22, cy2 + 6); X.quadraticCurveTo(cx2 - 11, cy2 - 16, cx2, cy2 + 4); X.quadraticCurveTo(cx2 + 11, cy2 + 22, cx2 + 22, cy2 - 4); X.stroke(); }
  X.fillStyle = '#fff'; for (const [px, py] of [[64, 64], [8, 8], [120, 8], [8, 120], [120, 120]]) { X.beginPath(); X.arc(px, py, 3, 0, 7); X.fill(); }
}, [20, 20]);
const craneWallTex = () => cvTex('craneWall', 480, 288, () => {
  X.fillStyle = '#9ad8ff'; X.fillRect(0, 0, 480, 288); X.fillStyle = 'rgba(255,255,255,.35)'; for (let x = 0; x < 480; x += 60) X.fillRect(x, 0, 30, 288);
  for (let i = 0; i < 26; i++) { const x = (i * 83) % 480, y = (i * 47) % 288; X.beginPath(); for (let k = 0; k < 8; k++) { const r = k % 2 ? 3 : 8 + i % 3 * 2, a = i + k * Math.PI / 4; X.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } X.closePath(); X.fillStyle = i % 2 ? 'rgba(255,225,77,.8)' : 'rgba(255,255,255,.75)'; X.fill(); }
});
const catTex = () => cvTex('catPoster', 256, 256, () => {
  rr(8, 8, 240, 240, 20); ink('#ffe14d', 7); rr(26, 26, 204, 204, 10); X.fillStyle = '#ff9ac0'; X.fill();
  cel(() => { X.beginPath(); X.moveTo(70, 120); X.lineTo(66, 54); X.lineTo(112, 86); X.lineTo(144, 86); X.lineTo(190, 54); X.lineTo(186, 120); X.closePath(); }, '#ff9a3c', '#d9741f', -6, 0, 5);
  cel(() => el(128, 150, 66, 56), '#ff9a3c', '#d9741f', -8, -6, 5);
  X.fillStyle = '#ffd2a0'; el(128, 170, 30, 20); X.fill();
  X.beginPath(); X.moveTo(120, 154); X.lineTo(136, 154); X.lineTo(128, 164); X.closePath(); ink('#ff5c8a', 2.5);
  X.beginPath(); X.moveTo(128, 164); X.quadraticCurveTo(118, 182, 106, 172); X.moveTo(128, 164); X.quadraticCurveTo(138, 182, 150, 172); X.strokeStyle = INK; X.lineWidth = 5; X.lineCap = 'round'; X.stroke();
  X.lineWidth = 4; for (const s of [-1, 1]) for (const dy of [-6, 8]) { X.beginPath(); X.moveTo(128 + s * 30, 168 + dy * .3); X.lineTo(128 + s * 76, 160 + dy); X.stroke(); }
});
reg3('td_crane', sp => {
  _td3.init();
  const S = T3.scene({ bg: 0x3a2a78, cam: [0, 5, 16.5], look: [0, 3.6, 0], fov: 50, ground: 0xffffff, sun: [6, 16, 10] });
  S.floor.position.y = -3.02; S.floor.material.map = carpetTex();
  const M = T3.mk;
  /* the poster cat's eyes follow the claw */
  const catEyes = quiet(() => {
  const wallDeco = new THREE.Mesh(new THREE.PlaneGeometry(15.6, 9.4), new THREE.MeshBasicMaterial({ map: craneWallTex() })); wallDeco.position.set(0, 4.7, -2.93); S.scene.add(wallDeco);
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({ map: catTex(), transparent: true })); poster.position.set(4.7, 6.2, -2.88); S.scene.add(poster);
  return [-.95, .95].map(ex => {
    const gE = new THREE.Group(), rim = new THREE.Mesh(new THREE.SphereGeometry(.64, 14, 10), new THREE.MeshBasicMaterial({ color: 0x14101c })), sc = new THREE.Mesh(new THREE.SphereGeometry(.54, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffffff })), pu = new THREE.Mesh(new THREE.SphereGeometry(.26, 10, 8), new THREE.MeshBasicMaterial({ color: 0x14101c }));
    rim.scale.z = sc.scale.z = .2; pu.scale.z = .2; pu.position.z = .14; sc.position.z = .07; gE.add(rim, sc, pu); gE.position.set(4.7 + ex, 6.65, -2.82); S.scene.add(gE); return { g: gE, pu, bx: 4.7 + ex };
  });
  });
  T3.box(S, 16, 3, 6, 0xff5c8a, [0, -1.5, 0]);                        // cabinet; its top (y=0) is the play floor
  T3.box(S, 16, 10, .3, 0x9ad8ff, [0, 5, -3.1]);                      // back wall
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) T3.box(S, .5, 9.6, .5, 0xffd84a, [sx * 7.9, 4.8, sz * 2.9]);
  T3.box(S, 16.6, 1.6, 6.6, 0xff5c8a, [0, 10.4, 0]);
  T3.box(S, 15.2, .35, .35, 0xb8b0c8, [0, 9, 0]);                      // rail
  const bulbs = [];
  for (let i = 0; i < 9; i++) bulbs.push(T3.sphere(S, .25, i % 2 ? 0xffe14d : 0xffffff, [-7 + i * 1.75, 9.6, 3.2], 1.12));
  const chute = T3.box(S, 2.6, .14, 4.4, 0x1c1226, [-6.35, .02, 0.2]); chute.castShadow = false;
  T3.box(S, .3, .4, 4.6, 0xffd84a, [-4.95, .2, .2]);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(15.6, 9, .05), new THREE.MeshLambertMaterial({ color: 0xbfe9ff, transparent: true, opacity: .13, depthWrite: false }));
  glass.position.set(0, 4.5, 3); S.scene.add(glass);
  // plushies
  const PAL = [[0xff8fa3, 0xffe3ea], [0xb98a5e, 0xf2d9b8], [0x7be07b, 0xe6ffd6], [0x7ab8ff, 0xe4f1ff], [0xffd23f, 0xfff4c2], [0xc59bff, 0xf0e4ff], [0xff9a3c, 0xffe2c2]];
  const plush = (pi, kind) => {
    const c = PAL[pi][0], c2 = PAL[pi][1], gr = new THREE.Group();
    const body = M.box(1.5, 1.3, 1.2, c); body.position.y = .65; gr.add(body);
    const belly = M.box(.8, .8, .1, c2, 1.05); belly.position.set(0, .65, .62); gr.add(belly);
    const head = M.box(1.35, 1.15, 1.15, c); head.position.y = 1.85; gr.add(head);
    const muzzle = M.box(.55, .35, .2, c2, 1.1); muzzle.position.set(0, 1.7, .62); gr.add(muzzle);
    const eyes = [];
    for (const ex of [-.32, .32]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(.2, .26, .1), new THREE.MeshBasicMaterial({ color: 0x14101c })); e.position.set(ex, 2.0, .6); gr.add(e);
      eyes.push(e);
      quiet(() => {   // eye glint + blush
        const hl = new THREE.Mesh(new THREE.BoxGeometry(.07, .07, .05), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(.03, .06, .06); e.add(hl);
        const bl = new THREE.Mesh(new THREE.PlaneGeometry(.2, .11), new THREE.MeshBasicMaterial({ color: 0xff7a95, transparent: true, opacity: .6 })); bl.position.set(ex * 1.6, 1.78, .59); gr.add(bl);
      });
    }
    const nose = new THREE.Mesh(new THREE.BoxGeometry(.2, .14, .1), new THREE.MeshBasicMaterial({ color: 0x14101c })); nose.position.set(0, 1.78, .74); gr.add(nose);
    gr.userData.eyes = eyes;
    for (const ex of [-.5, .5]) {
      let ear;
      if (kind === 0) ear = M.box(.4, .4, .3, c); else if (kind === 1) ear = M.box(.3, 1.0, .22, c); else if (kind === 2) ear = M.cone(.28, .6, c); else ear = M.sphere(.28, c2);
      ear.position.set(ex, kind === 1 ? 2.95 : 2.55, 0); gr.add(ear);
    }
    for (const ax of [-.95, .95]) { const a = M.box(.4, .8, .5, c); a.position.set(ax, .8, .1); gr.add(a); }
    for (const lx of [-.4, .4]) { const l = M.box(.5, .3, .8, c2); l.position.set(lx, .15, .35); gr.add(l); }
    return gr;
  };
  const xs = [-3.8, -1.9, .1, 2.1, 4.0, 5.9].map(x => x + (Math.random() - .5) * .5);
  const order = shuffle([0, 1, 2, 3, 4, 5, 6]);
  const prizes = xs.map((x, i) => {
    const m = plush(order[i], i % 4); const z = (Math.random() - .5) * .7;
    T3.add(S, m, [x, 0, z]); m.rotation.y = (Math.random() - .5) * .7;
    return { m, x, z, y: 0, vy: 0, st: 0 };   // st: 0 resting, 1 held, 2 falling, 3 in chute
  });
  /* decor: a heap of capsule balls in front of the plushies (own RNG) */
  const dr = dgen(1103), ballCol = [0xffd23f, 0x5fd2f7, 0xff7a95, 0x7be07b];
  quiet(() => { for (let i = 0; i < 14; i++) T3.sphere(S, .3, ballCol[i % 4], [-6.5 + dr() * 12.5, .3, 1.6 + dr() * .9], 1.1); });
  // claw
  const claw = new THREE.Group(), prongs = [];
  const hub = M.cyl(.4, .4, .5, 0xdddde8); claw.add(hub);
  const hub2 = M.sphere(.28, 0xff5c8a); hub2.position.y = .35; claw.add(hub2);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3, pv = new THREE.Group();
    pv.position.set(Math.cos(a) * .35, -.2, Math.sin(a) * .35); pv.rotation.y = -a;
    const arm = M.box(.2, 1.0, .24, 0xe9e9f4); arm.position.y = -.5; pv.add(arm);
    const tip = M.box(.2, .55, .22, 0xffd84a); tip.position.set(-.05, -.5, 0); tip.rotation.z = .6; tip.position.y = -.88; tip.position.x = -.14; pv.add(tip);
    claw.add(pv); prongs.push(pv);
  }
  T3.add(S, claw, [0, 8.2, 0]);
  const trolley = T3.box(S, 1.1, .55, 1.1, 0xff5c8a, [0, 9, 0]);
  const cable = M.cyl(.06, .06, 1, 0x333344, 1.3); T3.add(S, cable, [0, 8.6, 0]);
  const spot = new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, .03, 20), new THREE.MeshBasicMaterial({ color: 0x14101c, transparent: true, opacity: .28 }));
  spot.position.set(0, .12, 0); S.scene.add(spot);
  const chuteRays = sprite(S, raysTex(), 5, 5, [-6.35, 1.4, .9], true); chuteRays.visible = false;
  toonify(S, .58, .8);
  const TOP = 8.2, LOW = 3.7, SLIM = 6.7, CHUTE = -6.4;
  let cx = 0, tx = 0, hy = TOP, st = 'idle', pend = false, open = 1, ct = 0, held = null, slipH = 0, hang = 0, camShake = 0, tsec = 0, ot = 0, slipF = 0, btnT = 0;
  const vDown = 5 + 1.5 * (sp - 1), vUp = 5.5 + 1.5 * (sp - 1), vX = 11;
  _td3.init();
  const planeX = p => {
    S.ray.setFromCamera(_td3.ndc(p), S.camera);
    const h = S.ray.ray.intersectPlane(_td3.P, _td3.V); return h ? _td3.cl(h.x, -SLIM, SLIM) : tx;
  };
  const clank = () => { snd(180, .08, 'square', .09, 0, 90); snd(1500, .04, 'square', .05); noise(.07, .06, 2500, 7000, 'highpass'); sfx.hit(); camShake = .12; };
  const drop = () => { if (st !== 'idle') return; st = 'down'; btnT = .25; sfx.whoosh(false); sfx.tick(); };
  const g = {
    wide: true, cmd: 'GRAB!', hint: 'MOVE + CLICK / ARROWS + SPACE', thint: 'TAP WHERE TO GRAB', dur: 9,
    key(e) { if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'Enter') { if (st === 'idle') pend = true; } },
    move(p) { if (st === 'idle' && !pend) tx = planeX(p); },
    down(p) { if (st === 'idle' && !g.result) { tx = planeX(p); pend = true; } },
    update(dt, t) {
      S.t = t; tsec += dt; if (g.result) ot += dt; btnT = Math.max(0, btnT - dt); slipF = Math.max(0, slipF - dt);
      if (st === 'idle' && !g.result) {
        if (keys.ArrowLeft || keys.KeyA) tx -= 9 * dt; if (keys.ArrowRight || keys.KeyD) tx += 9 * dt;
        tx = _td3.cl(tx, -SLIM, SLIM);
      }
      const dx = tx - cx;
      if (st === 'idle' || st === 'carry') { const s = (st === 'carry' ? 9 : vX) * dt; cx += Math.abs(dx) < s ? dx : Math.sign(dx) * s; }
      if (st === 'idle' && pend && Math.abs(tx - cx) < .15) { pend = false; drop(); }
      if (st === 'down') {
        hy -= vDown * dt;
        if (hy <= LOW) {
          hy = LOW; st = 'close'; ct = 0; clank();
          let best = null, bd = 9;
          for (const p of prizes) if (p.st === 0) { const e = Math.abs(p.x - cx); if (e < bd) { bd = e; best = p; } }
          if (best && bd < 1.3) {
            const q = bd < .4 ? 1 : _td3.cl(1 - (bd - .4) / .7, 0, 1) * (1 - .1 * (sp - 1)) + .1;
            held = best; best.st = 1; hang = best.y - hy;
            slipH = Math.random() < q ? 99 : 5 + Math.random() * 1.5;
          }
        }
      } else if (st === 'close') {
        ct += dt; open = Math.max(0, 1 - ct / .3);
        if (ct >= .45) { st = 'up'; if (held) { sfx.blip(5); floatText(slipH > 90 ? 'GOT IT!' : 'HOLD ON...', W / 2, 90, '#fff', 30); } }
      } else if (st === 'up') {
        hy += vUp * dt;
        if (held && hy > slipH) { held.st = 2; held.vy = 0; held = null; slipH = 99; open = .6; slipF = 1.1; sfx.miss(); const s = _td3.scr(S, cx, hy - 2, 0); floatText('OOPS!', s.x, s.y, '#ff6a5a', 40); shake(4, .15); }
        if (hy >= TOP) { hy = TOP; if (held) { st = 'carry'; tx = CHUTE; sfx.sparkle(); } else { st = 'idle'; open = 1; } }
      } else if (st === 'carry') {
        if (Math.abs(cx - CHUTE) < .05) { st = 'release'; ct = 0; open = 1; held.st = 2; held.vy = 0; held.chute = true; sfx.tickHi(); }
      } else if (st === 'release') { ct += dt; if (ct > .6) { st = 'idle'; held = null; } }
      if (st === 'idle' && open < 1) open = Math.min(1, open + dt * 3);
      if (st === 'release') open = 1;
      // prize physics
      for (const p of prizes) {
        if (p.st === 1) {
          p.x += (cx - p.x) * Math.min(1, 12 * dt); p.z += (0 - p.z) * Math.min(1, 6 * dt);
          p.y = hy + hang; p.m.rotation.z = Math.sin(tsec * 6) * .08; p.m.rotation.x = Math.cos(tsec * 5) * .05;
        } else if (p.st === 2) {
          p.vy -= 28 * dt; p.y += p.vy * dt; p.m.rotation.z *= .9;
          if (p.chute) {
            if (p.y < -.3 && p.st === 2) {
              p.st = 3; p.pop = 0;
              if (!g.result) {
                g.result = 'win'; const s = _td3.scr(S, CHUTE, 1, 1);
                sfx.thud(); sfx.coin(); sfx.sparkle(); confetti(W / 2, 260, 55); burst(s.x, s.y, '#FFE14D', 26, 380); ring(s.x, s.y, '#fff', 140, .5); floatText('PRIZE!', W / 2, 150, '#FFE14D', 56); shake(7, .3);
              }
            }
          } else if (p.y <= 0) { p.y = 0; if (p.vy < -3) { sfx.thud(); camShake = .08; } p.vy = 0; p.st = 0; }
        } else if (p.st === 3) {   // the prize pops back out of the exit chute
          p.pop += dt; const k = ease(p.pop / .45);
          p.x = CHUTE; p.z = .3; p.y = lerp(-1.6, 1.1, k) + (p.pop > .45 ? Math.sin((p.pop - .45) * 9) * .12 : 0); p.m.rotation.y = p.pop * 6; p.m.rotation.z = Math.sin(p.pop * 14) * .1; p.m.scale.setScalar(lerp(.9, 1.25, k));
        }
        p.m.position.set(p.x, p.y, p.z);
        const wide = p.st === 1 || p.st === 2 || p.st === 3 ? 1.55 : 1;
        for (const e of p.m.userData.eyes) e.scale.setScalar(wide);
      }
      claw.position.set(cx, hy, 0);
      trolley.position.x = cx;
      cable.position.set(cx, (9 + hy) / 2 + .2, 0); cable.scale.y = 9 - hy - .2;
      const lose = g.result === 'lose';
      const ang = -.3 + (lose ? 1.3 : open) * .95;
      for (const pv of prongs) pv.rotation.z = ang;
      spot.position.x = cx; spot.visible = st === 'idle' || st === 'down';
      claw.rotation.y = Math.sin(tsec * 3) * .05;
      // the operator on the trolley, the marquee, the poster cat
      const win = g.result === 'win';
      bulbs.forEach((b, i) => {
        const col = win ? new THREE.Color().setHSL(((i * 30 + tsec * 600) % 360) / 360, .9, .6).getHex() : lose ? ((i + Math.floor(tsec * 3)) % 2 ? 0xff4d5e : 0x6a2030) : (i + Math.floor(tsec * 4)) % 2 ? 0xffe14d : 0xffffff;
        b.material.color.setHex(col);
      });
      for (const e of catEyes) {
        e.pu.position.x = clp((cx - e.bx) * .045, -.2, .2); e.pu.position.y = clp((hy - 6.6) * .04, -.16, .16); e.g.scale.y = lose ? .15 : win ? 1.1 : 1;
        e.pu.material.color.setHex(win ? 0xff5c8a : 0x14101c); e.pu.scale.x = e.pu.scale.y = win ? 1.5 : 1;
      }
      chuteRays.visible = win; if (win) { chuteRays.rotation.z = tsec * 1.5; chuteRays.material.opacity = .8; }
      camShake *= Math.max(0, 1 - 10 * dt);
      const cam = S.camera;
      cam.position.x += (cx * .12 - cam.position.x) * Math.min(1, 4 * dt);
      cam.position.y = 5; if (camShake > .01) T3.shakeCam(S, camShake);
      cam.lookAt(cam.position.x * .5, 3.6, 0);
    },
    draw(t) {
      X = ctx; _td3.render(S);
      const win = g.result === 'win', lose = g.result === 'lose';
      // glass glare
      X.save(); X.fillStyle = 'rgba(255,255,255,.08)'; for (const [a, b, w2] of [[-120, 60, 70], [250, 60, 28]]) { X.beginPath(); X.moveTo(a + OX * 0, b); X.lineTo(a + w2, b); X.lineTo(a + w2 + 180, 500); X.lineTo(a + 180, 500); X.closePath(); X.fill(); } X.restore();
      if (st === 'idle' && !g.result) {
        const s = _td3.scr(S, cx, 1.2, 0);
        X.setLineDash([10, 10]); X.beginPath(); X.moveTo(s.x, s.y); X.lineTo(s.x, s.y - 150); X.lineCap = 'round'; X.strokeStyle = 'rgba(20,16,28,.5)'; X.lineWidth = 8; X.stroke();
        X.globalAlpha = .65 + .3 * Math.sin(t * 8); X.strokeStyle = '#fff'; X.lineWidth = 4; X.stroke(); X.setLineDash([]); X.globalAlpha = 1;
      }
      // the exit chute sign
      const ch = _td3.scr(S, CHUTE, .4, 1.4);
      rr(ch.x - 34, ch.y - 15 + Math.sin(t * 5) * 2, 68, 28, 8); ink('#2b2440', 3.5); txt('EXIT', ch.x, ch.y + 1 + Math.sin(t * 5) * 2, 20, '#ffd84a', 'center', 62);
      // the control deck painted on the cabinet front
      const dx0 = W / 2 - 150, dy0 = 506, press = btnT > 0 || st === 'down';
      rr(dx0, dy0, 300, 40, 12); ink('#3b3550', 4); glint(dx0 + 60, dy0 + 7, 40, 3, 0, .3);
      const jx = dx0 + 44 + clp(tx - cx, -1, 1) * 5; tube(dx0 + 44, dy0 + 26, jx, dy0 + 12, 5, '#c9ced6');
      X.beginPath(); X.arc(jx, dy0 + 9, 9, 0, 7); ink('#ff4d5e', 3); glint(jx - 3, dy0 + 5, 3, 2, 0, .7);
      X.beginPath(); X.arc(dx0 + 258, dy0 + 22, 15, 0, 7); ink('#23a046', 3); X.beginPath(); X.arc(dx0 + 258, dy0 + 19 + (press ? 3 : 0), 12, 0, 7); ink(press ? '#5CFF7A' : '#4fd06a', 2.5);
      if (!TOUCH) { keyCap(dx0 + 108, dy0 + 20, '<'); keyCap(dx0 + 144, dy0 + 20, '>'); keyCap(dx0 + 204, dy0 + 20, 'SPACE'); }
      if (win) for (let i = 0; i < 4; i++) { const f = (ot * 1.3 + i / 4) % 1, s = _td3.scr(S, CHUTE, 1.8, 1); heart(s.x - 40 + i * 28 + Math.sin(f * 6 + i) * 6, s.y - f * 90, 9 + (1 - f) * 3, '#ff5c8a'); }
      // the player at the cabinet: eyes on the claw, panics when the prize slips, cheers on the win
      const hx = W + OX - 66, hyy = 538, cs = _td3.scr(S, cx, hy, 0), mood = win ? 'happy' : lose || slipF > 0 ? 'sad' : (st === 'close' || st === 'up' || st === 'carry') && held ? 'panic' : st === 'idle' ? 'idle' : 'eager';
      const lift = win ? Math.abs(Math.sin(ot * 9)) * 14 : 0;
      hero2d(hx, hyy, 4.4, mood, clp((cs.x - hx) / 300, -1, 1), clp((cs.y - hyy) / 300, -1, 1), { lift, k: 2, al: win ? [-1.4, -3.4] : [-1.2, 3.2], ar: win ? [1.4, -3.4] : st === 'idle' ? [-1, 3.2] : [1.2, 3.2] });
      if (mood === 'panic' || lose || slipF > 0) { sweat(hx - 36, hyy - 52, 4.5, t, 0); sweat(hx + 34, hyy - 48, 3.8, t, .5); }
      vignette(.22);
    },
  };
  return g;
}, 'Claw Grab');

/* ───────────── 4. LAVA HOP: hop across croutons over a giant bowl of tomato soup ───────────── */
let _starGeo = null;
const soupTex = () => cvTex('soup', 256, 256, () => {
  X.fillStyle = '#e8472a'; X.fillRect(0, 0, 256, 256);
  const r = dgen(55);
  for (let i = 0; i < 26; i++) { const x = r() * 256, y = r() * 256, rx = 14 + r() * 26; for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) { el(x + ox, y + oy, rx, rx * .55, r()); X.fillStyle = i % 2 ? '#f26a3a' : '#cf3a22'; X.fill(); } }
  X.strokeStyle = '#ffd9a0'; X.lineWidth = 4; X.lineCap = 'round'; for (let i = 0; i < 9; i++) { const x = r() * 256, y = r() * 256; X.beginPath(); X.moveTo(x, y); X.quadraticCurveTo(x + 18, y - 14, x + 38, y + 2); X.stroke(); }
}, [30, 30]);
const toastTex = c => cvTex('toast' + c, 64, 64, () => {
  X.fillStyle = '#' + ('000000' + c.toString(16)).slice(-6); X.fillRect(0, 0, 64, 64); X.fillStyle = 'rgba(255,255,255,.28)'; rr(6, 6, 52, 52, 8); X.fill();
  X.fillStyle = 'rgba(120,70,30,.4)'; for (const [x, y] of [[14, 18], [40, 14], [24, 42], [48, 44], [34, 30]]) { X.beginPath(); X.arc(x, y, 2.4, 0, 7); X.fill(); }
});
const steamTex = () => cvTex('steam', 128, 128, () => { const g = X.createRadialGradient(64, 64, 0, 64, 64, 60); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.6, 'rgba(255,255,255,.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); X.fillStyle = g; X.fillRect(0, 0, 128, 128); });
reg3('td_hop', sp => {
  _td3.init();
  const S = T3.scene({ bg: 0xe8532e, fog: [28, 80], cam: [-3.5, 6.5, 11], look: [3, .5, 0], sun: [8, 16, 7] });
  const lava = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshBasicMaterial({ color: 0xffffff, map: soupTex() }));
  soupTex().offset.set(0, 0);
  lava.rotation.x = -Math.PI / 2; lava.position.y = -3; S.scene.add(lava);
  const SP = 5, n = 4 + (sp > 1.5), M = T3.mk;
  const bubbles = [];
  for (let i = 0; i < 16; i++) {
    const b = quiet(() => {   // soup bubble: tomato-red toon blob, inked hull and a glint (decor only)
      const bb = new THREE.Mesh(new THREE.SphereGeometry(.42, 14, 10), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff7a4c : 0xff5a3c, transparent: true, opacity: .8 }));
      const hull = new THREE.Mesh(new THREE.SphereGeometry(.42, 14, 10), new THREE.MeshBasicMaterial({ color: 0x3a1020, side: THREE.BackSide, transparent: true, opacity: .8 })); hull.scale.setScalar(1.14); bb.add(hull);
      const gl = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); gl.position.set(-.16, .2, .3); bb.add(gl);
      return bb; });
    b.userData = { bx: -12 + Math.random() * (n * SP + 26), bz: (Math.random() - .5) * 14, ph: Math.random() * 6, f: 1 + Math.random() };
    b.position.set(b.userData.bx, -3, b.userData.bz); S.scene.add(b); bubbles.push(b);
  }
  const COLS = [0xff7ac6, 0x6ee7b7, 0xffd84a, 0xa99bff, 0xff9a5a];
  const plats = [];
  for (let i = 0; i <= n; i++) {
    const last = i === n, w = i === 0 ? 3.6 : last ? 3.8 : Math.max(2.5, 3.1 - .35 * (sp - 1));
    const col = last ? 0xffd23f : i === 0 ? 0x9be36a : COLS[i % COLS.length];
    const gr = new THREE.Group(), top = M.box(w, .6, 3, col); gr.add(top);
    top.material.map = toastTex(last ? 0xffd23f : i === 0 ? 0xf0c070 : col); top.material.color.setHex(0xffffff);
    const rock = M.cone(1.1, 1.8, 0x8a6a5a); rock.position.y = -1.2; rock.rotation.x = Math.PI; rock.scale.set(w / 3, 1, 1); rock.visible = false; gr.add(rock);   // the old rock: kept so the seeded stream is identical, hidden by the stem
    const rip = quiet(() => {   // toast crust, breadstick stem, ripple, butter pat
      const crust = M.box(w * .98, .32, 2.9, 0xc98a44); crust.position.y = -.42; gr.add(crust);
      const stem = M.cyl(.55, .75, 2.7, 0xe3b26a); stem.position.y = -1.65; gr.add(stem);
      const r = new THREE.Mesh(new THREE.RingGeometry(1, 1.25, 28), new THREE.MeshBasicMaterial({ color: 0xffe9c4, transparent: true, opacity: .55, side: THREE.DoubleSide, fog: false })); r.rotation.x = -Math.PI / 2; r.position.y = -2.95; r.scale.set(1, 1.1, 1); gr.add(r);
      if (i === 0) { const bt = M.box(.9, .22, .7, 0xffe27a); bt.position.set(-w / 2 + .7, .4, .9); gr.add(bt); }
      return r;
    });
    const bx = i * SP, bz = i === 0 || last ? 0 : (i % 2 ? .5 : -.5);
    T3.add(S, gr, [bx, 0, bz]);
    const mov = i >= 2 && !last && (i % 2 === 0 || sp > 1.4);
    plats.push({ gr, rip, w, bx, bz, x: bx, amp: mov ? 1.0 + .5 * (sp - 1) : 0, spd: 1.3 + .6 * Math.random() + .4 * (sp - 1), ph: Math.random() * 6.28 });
  }
  // gold star on the final platform
  if (!_starGeo) {
    const sh = new THREE.Shape();
    for (let k = 0; k < 10; k++) { const r = k % 2 ? .4 : 1, a = Math.PI / 2 + k * Math.PI / 5; k ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    _starGeo = new THREE.ExtrudeGeometry(sh, { depth: .3, bevelEnabled: false }); _starGeo.translate(0, 0, -.15); _starGeo._keep = true;
  }
  const star = new THREE.Mesh(_starGeo, new THREE.MeshPhongMaterial({ color: 0xffe14d, flatShading: true, shininess: 0, specular: 0x000000 }));
  star.add(new THREE.Mesh(_starGeo, new THREE.MeshBasicMaterial({ color: 0x14101c, side: THREE.BackSide }))); star.children[0].scale.setScalar(1.12);
  star.position.set(n * SP, 1.8, 0); star.scale.setScalar(.9); star.castShadow = true; S.scene.add(star);
  const marker = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .05, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .75 }));
  S.scene.add(marker);
  const CS = .42, cl = hero3(S, CS, [0, .3, 0], 0); cl.rotation.y = .6;
  /* decor (own RNG): basil leaves on the soup, steam, a rubber duck that swims along, the star's rays and the splash pool */
  const dr = dgen(2024), leaves = [];
  const dec = quiet(() => {
  for (let i = 0; i < 12; i++) { const lf = new THREE.Mesh(new THREE.CircleGeometry(.55, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x2f9a55 : 0x3fb260 })); lf.rotation.x = -Math.PI / 2; lf.scale.y = 1.5; lf.userData = { ox: dr() * 60 - 14, oz: -dr() * 16 - 1.5, ph: dr() * 6, r: dr() * 3 }; lf.position.y = -2.97; S.scene.add(lf); leaves.push(lf); }
  const steam = []; for (let i = 0; i < 9; i++) { const s = sprite(S, steamTex(), 3.4, 3.4, [0, 0, -3 - dr() * 9]); s.userData = { ox: dr() * 34 - 12, off: dr() }; steam.push(s); }
  const duck = new THREE.Group(), DM = T3.mk;
  const dBody = DM.sphere(1.3, 0xffd84a); dBody.scale.set(1.25, .85, 1); dBody.position.y = .3; duck.add(dBody);
  const dHead = DM.sphere(.85, 0xffd84a); dHead.position.set(1.05, 1.5, 0); duck.add(dHead);
  const dBeak = DM.box(.7, .22, .7, 0xff8a3c, 1.1); dBeak.position.set(1.8, 1.4, 0); duck.add(dBeak);
  const dBeakL = DM.box(.6, .16, .6, 0xe0702a, 1.1); dBeakL.position.set(1.75, 1.2, 0); duck.add(dBeakL);
  for (const ez of [-.4, .4]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0x14101c })); e.position.set(1.45, 1.8, ez); duck.add(e); }
  const dTail = DM.cone(.5, 1, 0xffd84a); dTail.rotation.z = .9; dTail.position.set(-1.7, 1, 0); duck.add(dTail);
  const dCrown = DM.cone(.5, .6, 0xffe14d); dCrown.position.set(1.0, 2.5, 0); dCrown.visible = false; duck.add(dCrown);
  duck.scale.setScalar(1.15); duck.rotation.y = Math.PI; S.scene.add(duck);
  const rays = sprite(S, raysTex(), 7, 7, [n * SP, 1.9, -.6], true);
  const splash = []; for (let i = 0; i < 14; i++) { const sb = new THREE.Mesh(new THREE.SphereGeometry(.4 + (i % 3) * .14, 8, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xb52a14 : 0xffe9c4 })); sb.visible = false; S.scene.add(sb); splash.push({ m: sb, vx: Math.cos(i * 2.4) * (2.5 + i % 4 * 1.2), vy: 9 + (i % 5) * 1.6, vz: Math.sin(i * 2.4) * 2.5 }); }
  const sRing = new THREE.Mesh(new THREE.RingGeometry(1, 1.3, 28), new THREE.MeshBasicMaterial({ color: 0xffe9c4, transparent: true, opacity: .8, side: THREE.DoubleSide })); sRing.rotation.x = -Math.PI / 2; sRing.visible = false; S.scene.add(sRing);
  return { steam, duck, dBeak, dBeakL, dCrown, rays, splash, sRing };
  });
  const { steam, duck, dBeak, dBeakL, dCrown, rays, splash, sRing } = dec;
  toonify(S, .55, .75);
  const VX = 7, VY = 9.2, GR = 26, TOPY = .3, AIR = 2 * VY / GR, REACH = VX * AIR;
  let cx = 0, cy = TOPY, cz = 0, vy = 0, air = false, on = 0, sq = 0, camx = 0, lookx = 3, camShake = 0, tsec = 0, done = 0, sink = 0, ft = 0, ot = 0, lt = 0, sx0 = 0;
  const jump = () => { if (air || g.result) return; air = true; vy = VY; sq = -1; sfx.boing(); sfx.whoosh(true); };
  const g = {
    wide: true, cmd: 'HOP!', hint: 'SPACE / CLICK: HOP TO THE STAR', thint: 'TAP TO HOP TO THE STAR', dur: 8,
    key(e) { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowRight' || e.code === 'KeyW' || e.code === 'KeyD') jump(); },
    down() { jump(); },
    update(dt, t) {
      S.t = t; tsec += dt; if (g.result) ot += dt; if (g.result === 'lose') lt += dt;
      soupTex().offset.x = tsec * .012;
      for (let i = 0; i < plats.length; i++) {
        const p = plats[i], nx = p.bx + p.amp * Math.sin(tsec * p.spd + p.ph), d = nx - p.x; p.x = nx;
        p.gr.position.x = nx; p.gr.position.y = Math.sin(tsec * 1.5 + i) * .05;
        p.rip.scale.setScalar(.8 + .08 * Math.sin(tsec * 2 + i)); p.rip.scale.y = p.rip.scale.x * 1.1;
        if (!air && on === i && !done) cx += d;
      }
      for (const b of bubbles) { const u = b.userData, k = Math.abs(Math.sin(tsec * u.f + u.ph)); b.position.y = -3.05 + k * .3; b.scale.setScalar(.3 + k); }
      star.rotation.y = tsec * 2.2; star.position.y = 1.9 + Math.sin(tsec * 3) * .15;
      if (!g.result || g.result === 'win') {
        if (air) {
          const py = cy; vy -= GR * dt; cy += vy * dt; cx += VX * dt;
          if (vy < 0 && py >= TOPY - .15 && cy <= TOPY) {
            for (let i = 0; i < plats.length; i++) {
              const p = plats[i];
              if (Math.abs(cx - p.x) < p.w / 2 + .25 && Math.abs(cz - p.bz) < 1.7) {
                air = false; cy = TOPY; vy = 0; on = i; sq = 1; camShake = .1;
                const s = _td3.scr(S, cx, .3, cz);
                ring(s.x, s.y, '#fff', 90, .35); burst(s.x, s.y, '#FFE14D', 8, 180); sfx.thud(); sfx.blip(i * 2);
                if (i === n) {
                  g.result = 'win'; done = 1; sfx.sparkle(); sfx.coin(); confetti(W / 2, 220, 55); floatText('STAR!', W / 2, 140, '#FFE14D', 56); shake(6, .3);
                } else if (i > 0) floatText(i + '/' + n, s.x, s.y - 60, '#fff', 30);
                break;
              }
            }
          }
          if (air && cy < -2.6 && !g.result) {
            g.result = 'lose'; air = false; const s = _td3.scr(S, cx, -3, cz);
            sfx.splat(); sfx.buzz(); shake(10, .35); camShake = .4; burst(s.x, s.y, '#ff8a3c', 26, 380); ring(s.x, s.y, '#ffd23f', 150, .5); floatText('SIZZLE!', W / 2, 200, '#ff6a5a', 52);
            sink = 1; sx0 = cx;
            for (const q2 of splash) { q2.m.visible = true; q2.m.position.set(cx, -2.9, cz); }
            sRing.visible = true; sRing.position.set(cx, -2.93, cz);
          }
        }
      }
      if (sink) { cy -= dt * 2; }
      if (g.result === 'win') {
        cl.rotation.y += dt * 8; cl.armL.position.y = cl.armR.position.y = 1.9 + Math.sin(tsec * 20) * .2;
        const k = ease(ot / .35); star.position.x = lerp(n * SP, cx, k); star.position.y = lerp(1.9, cy + 3.2, k) + Math.sin(tsec * 6) * .1 * k; star.scale.setScalar(lerp(.9, 1.35, k));
        rays.position.set(star.position.x, star.position.y, -.6);
      }
      else cl.rotation.y += (.6 - cl.rotation.y) * Math.min(1, 10 * dt);
      sq *= Math.max(0, 1 - 9 * dt);
      const stretch = air ? Math.min(.25, Math.abs(vy) * .02) : 0;
      cl.scale.set(CS * (1 - stretch * .6 + (sq > 0 ? sq * .25 : 0)), CS * (1 + stretch - (sq > 0 ? sq * .3 : 0)), CS * (1 - stretch * .6 + (sq > 0 ? sq * .25 : 0)));
      cl.position.set(cx, cy, cz);
      cl.legs.forEach((l, i) => { l.rotation.x = air ? Math.sin(tsec * 18 + i) * .5 : 0; });
      if (!air && !g.result) { const bob = Math.sin(tsec * 6) * .03; cl.body.position.y = 1.65 + bob; }
      marker.visible = !air && !g.result; marker.position.set(cx + REACH, TOPY + .06, cz); marker.scale.setScalar(1 + Math.sin(tsec * 8) * .1);
      // faces: calm, eager in the air, scared when falling, happy on the star, scalded in the soup
      const nearStar = !air && on === n - 1, lose = g.result === 'lose';
      setFace(cl, g.result === 'win' ? 'happy' : lose ? 'dizzy' : air && vy < -3 && cy < TOPY - .2 ? 'panic' : air ? 'eager' : nearStar ? 'panic' : 'idle', .8, air && vy < 0 ? .5 : -.1);
      if (lose) tint(cl, mixHex(0xD97757, 0xc8301f, clp(lt / .5, 0, 1)));
      // splash + ripple + the duck's reactions
      if (lose) {
        for (const q2 of splash) { q2.vy -= 24 * dt; q2.m.position.x += q2.vx * dt; q2.m.position.y += q2.vy * dt; q2.m.position.z += q2.vz * dt; if (q2.m.position.y < -3.05) q2.m.visible = false; }
        sRing.scale.setScalar(1 + lt * 7); sRing.material.opacity = Math.max(0, .8 - lt * 1.3);
      }
      // camera
      camx += (cx - camx) * Math.min(1, 3 * dt); lookx += (cx + 3.5 - lookx) * Math.min(1, 3 * dt);
      for (const lf of leaves) { const u = lf.userData; lf.position.x = camx + ((u.ox - camx * .6 + 400) % 60) - 14; lf.position.z = u.oz; lf.rotation.z = u.r + tsec * .3; }
      steam.forEach((s, i) => { const u = s.userData, f = (tsec * .09 + u.off) % 1; s.position.x = camx + u.ox + Math.sin(f * 7 + i) * 1.2; s.position.y = -2.4 + f * 10; s.material.opacity = Math.sin(f * Math.PI) * .38; s.scale.setScalar(.8 + f * 1.1); });
      duck.position.set(camx + 13, -2.4 + Math.sin(tsec * 2.2) * .14, -12); duck.rotation.z = Math.sin(tsec * 2.2 + 1) * .06 + (lose ? Math.sin(tsec * 40) * .06 : 0);
      dBeak.position.y = lose ? 1.62 : 1.4; dBeakL.position.y = lose ? .98 : 1.2; dCrown.visible = g.result === 'win';
      camShake *= Math.max(0, 1 - 9 * dt);
      const cam = S.camera; cam.position.set(camx - 3.5, 6.5 + (air ? .2 : 0), 11);
      if (camShake > .01) T3.shakeCam(S, camShake);
      cam.lookAt(lookx, .5, 0);
    },
    draw(t) {
      X = ctx; _td3.render(S);
      const win = g.result === 'win', lose = g.result === 'lose';
      // progress: a row of croutons with Claude riding the current one
      const pw = 34 * (n + 1) + 20, px0 = W / 2 - pw / 2;
      rr(px0, 60, pw, 30, 15); ink('#2b2440', 3.5);
      for (let i = 0; i <= n; i++) { const bx = px0 + 28 + i * 34; rr(bx - 11, 69, 22, 14, 4); ink(i === n ? '#ffd23f' : i <= on && !lose ? '#5CFF7A' : '#f0c070', 2.5); }
      claude(px0 + 28 + on * 34, 70, 1.4, { col: OR, mood: win ? 'happy' : lose ? 'sad' : 'none' });
      const cp = _td3.scr(S, cx, .3 + 1.6, cz);
      if (win) for (let i = 0; i < 4; i++) { const f = (ot * 1.3 + i / 4) % 1; heart(cp.x - 55 + i * 36 + Math.sin(f * 6 + i) * 6, cp.y - 30 - f * 80, 9 + (1 - f) * 3, '#ff5c8a'); }
      if (lose) { const s = _td3.scr(S, sx0, -2.4, cz); for (let i = 0; i < 3; i++) { const f = (lt * 1.2 + i / 3) % 1; X.beginPath(); X.moveTo(s.x - 26 + i * 26, s.y - 20 - f * 60); X.quadraticCurveTo(s.x - 14 + i * 26, s.y - 40 - f * 60, s.x - 26 + i * 26, s.y - 62 - f * 60); X.strokeStyle = 'rgba(255,255,255,' + (.8 - f * .6) + ')'; X.lineWidth = 6; X.lineCap = 'round'; X.stroke(); } }
      if (!air && !g.result && t < 2) { plate(W / 2 - 100, 480, 200, 56, '#ffd23f', '#c99512', false); txt(TOUCH ? 'TAP!' : 'SPACE!', W / 2, 515, 34, INK, 'center', 180); }
      vignette(.22);
    },
  };
  return g;
}, 'Lava Hop');
})();
