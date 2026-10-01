'use strict';
/* 3D stage, part 3: td_cube (match the orientation), td_lanes (3-lane runner), td_crane (claw machine), td_hop (platform hopper).
   All use the T3 toolkit from td_core.js. Per-frame work only mutates pre-built meshes / reused vectors. */

const _td3 = {
  V: null, P: null,
  /* lazily created shared scratch objects (THREE must already be loaded) */
  init() { if (!this.V) { this.V = new THREE.Vector3(); this.P = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); } },
  cl: (v, a, b) => v < a ? a : v > b ? b : v,
  /* 2D overlay helper: world point (x,y,z) → canvas px, no allocation */
  scr(S, x, y, z) { _td3.init(); _td3.V.set(x, y, z); return T3.screen(S, _td3.V); },
};

/* ───────────── 1. CUBE MATCH ───────────── */
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

reg3('td_cube', sp => {
  _td3.init();
  const S = T3.scene({ bg: 0xb9a7ff, cam: [0, .6, 8.4], look: [0, .1, 0], fov: 45, ground: 0xcbb4ff, sun: [4, 10, 8] });
  S.floor.position.y = -3.2;
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
  tgt.quaternion.copy(target);
  const TOL = .45 - .06 * (sp - 1);
  let drag = false, lx = 0, ly = 0, holdT = 0, pulse = 0, matched = false, ang = 9;
  const snap = () => { let b = 0, bd = -1; for (let i = 0; i < 24; i++) { const d = Math.abs(ORI[i].dot(q)); if (d > bd) { bd = d; b = i; } } goal.copy(ORI[b]); if (goal.dot(q) < 0) { goal.x *= -1; goal.y *= -1; goal.z *= -1; goal.w *= -1; } };
  const g = {
    cmd: 'MATCH!', hint: 'DRAG OR ARROWS: COPY THE TARGET', thint: 'DRAG THE CUBE TO MATCH', dur: 7,
    key(e) {
      if (g.result || drag) return;
      let m = null;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') m = 3; else if (e.code === 'ArrowRight' || e.code === 'KeyD') m = 2;
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') m = 1; else if (e.code === 'ArrowDown' || e.code === 'KeyS') m = 0;
      if (m == null) return;
      goal.premultiply(moves[m]); sfx.click(); sfx.whoosh(true); pulse = 1;
    },
    down(p) { if (g.result) return; drag = true; lx = p.x; ly = p.y; goal.copy(q); sfx.tick(); },
    move(p) {
      if (!drag || g.result) return;
      const dx = p.x - lx, dy = p.y - ly; lx = p.x; ly = p.y;
      tmp.setFromAxisAngle(AY, dx * .012); q.premultiply(tmp);
      tmp.setFromAxisAngle(AX, dy * .012); q.premultiply(tmp);
      q.normalize(); goal.copy(q);
    },
    up() { if (!drag) return; drag = false; snap(); sfx.click(); pulse = .6; },
    update(dt, t) {
      S.t = t;
      if (!drag) q.slerp(goal, 1 - Math.exp(-14 * dt));
      cube.quaternion.copy(q);
      cube.position.y = Math.sin(t * 2.2) * .12;
      pulse = Math.max(0, pulse - dt * 4); const sc = 1 + pulse * .08 + (g.result === 'win' ? Math.sin(t * 18) * .04 : 0); cube.scale.setScalar(sc);
      tgt.position.y = 2.55 + Math.sin(t * 2.2 + 1) * .08;
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
      T3.render(S);
      const c = _td3.scr(S, 0, cube.position.y, 0);
      if (matched || g.result) {
        ctx.strokeStyle = '#7dff7a'; ctx.lineWidth = 8; ctx.globalAlpha = .55 + .25 * Math.sin(t * 20);
        ctx.beginPath(); ctx.arc(c.x, c.y, 220, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
      }
      // target frame
      const tp = _td3.scr(S, -5.1, 2.55, 1.2);
      ctx.save(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(tp.x - 78, tp.y - 74, 156, 168); ctx.strokeRect(tp.x - 78, tp.y - 74, 156, 168); ctx.restore();
      txt('TARGET', tp.x, tp.y + 72, 24, '#fff', 'center', 140);
      // hold bar
      const k = Math.min(1, holdT / .3);
      ctx.fillStyle = INK; ctx.fillRect(W / 2 - 104, 520, 208, 28);
      ctx.fillStyle = '#7dff7a'; ctx.fillRect(W / 2 - 100, 524, 200 * k, 20);
      if (!g.result && !drag && t < 2.2) txt(TOUCH ? 'DRAG ME' : 'DRAG / ARROWS', W / 2, 470, 28, '#fff', 'center', 300);
      vignette(.25);
    },
  };
  return g;
}, 'Cube Match');

/* ───────────── 2. LANE RUNNER ───────────── */
reg3('td_lanes', sp => {
  _td3.init();
  const S = T3.scene({ bg: 0x8fd8ff, fog: [28, 85], cam: [0, 4.6, 7.4], look: [0, 1.2, -9], ground: 0x7ccf5a, sun: [6, 14, 4] });
  const road = T3.box(S, 10, .2, 150, 0x6f6882, [0, .02, -55]); road.castShadow = false;
  T3.box(S, .5, .35, 150, 0xffffff, [-5.2, .1, -55]).castShadow = false;
  T3.box(S, .5, .35, 150, 0xffffff, [5.2, .1, -55]).castShadow = false;
  const LOOP = 96;
  const stripes = [];
  for (let i = 0; i < 12; i++) for (const sx of [-1.5, 1.5]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(.22, .03, 2.6), new THREE.MeshBasicMaterial({ color: 0xfff3a8 }));
    s.position.set(sx, .14, 10 - i * 8); S.scene.add(s); stripes.push(s);
  }
  const trees = [];
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1, tr = new THREE.Group(), M = T3.mk;
    const trunk = M.cyl(.3, .4, 1.2, 0x8a5a3c); trunk.position.y = .6; tr.add(trunk);
    const c1 = M.cone(1.5, 2.4, i % 3 ? 0x3fb64f : 0x2e9e6a); c1.position.y = 2.2; tr.add(c1);
    const c2 = M.cone(1.1, 1.8, i % 3 ? 0x4ccb5c : 0x3bb57e); c2.position.y = 3.4; tr.add(c2);
    T3.add(S, tr, [side * (7.5 + (i * 7 % 5)), 0, 10 - Math.floor(i / 2) * 12]); trees.push(tr);
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
    const crate = M.box(1.5, .9, 1.5, 0xffc34a); crate.position.y = .45; o.add(crate);
    T3.add(S, o, [0, 0, 50]); o.visible = false;
    pool.push({ o, parts: [boulder, bg2, crate], kind: 0, x: 0, z: 0, on: false });
  }
  const cl = T3.claude(S, .5, OR, [0, 0, 0]); cl.rotation.y = Math.PI;
  const v0 = 17 + 5 * (sp - 1), spacing = 13 - 1.2 * (sp - 1);
  let lane = 0, cx = 0, y = 0, vy = 0, acc = 0, v = v0, rt = 0, shakeV = 0, hitT = 0, passN = 0;
  const spawnRow = z => {
    const free = Math.floor(Math.random() * 3), r = Math.random();
    const lanes = r < .14 ? [0, 1, 2] : (r < .14 + .4 * Math.min(1, sp - .3) ? [0, 1, 2].filter(i => i !== free) : [free === 1 ? 0 : 1]);
    const allCrate = lanes.length === 3;
    for (const li of lanes) {
      const p = pool.find(q => !q.on); if (!p) return;
      p.on = true; p.kind = allCrate ? 2 : Math.floor(Math.random() * 3); p.x = (li - 1) * 3; p.z = z; p.o.visible = true;
      p.parts.forEach((m, i) => m.visible = i === p.kind);
      p.o.position.set(p.x, 0, z); p.o.rotation.set(0, 0, 0);
      p.parts[0].rotation.set(0, 0, 0); p.parts[1].rotation.set(0, 0, 0);
    }
  };
  for (let z = -26; z > -62; z -= spacing) spawnRow(z);
  const jump = () => { if (y <= 0 && !g.result) { vy = 9.2; sfx.boing(); sfx.whoosh(true); } };
  const go = d => { const n = _td3.cl(lane + d, -1, 1); if (n !== lane && !g.result) { lane = n; sfx.whoosh(d > 0); shakeV = .06; } };
  const g = {
    cmd: 'RUN!', hint: 'ARROWS / A D: DODGE · SPACE: JUMP', thint: 'TAP SIDES: DODGE · TAP MIDDLE: JUMP', dur: 7, timeWin: true,
    key(e) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') go(-1);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') go(1);
      else if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') jump();
    },
    down(p) { if (p.x < W * .36) go(-1); else if (p.x > W * .64) go(1); else jump(); },
    update(dt, t) {
      S.t = t; rt += dt;
      if (g.result === 'lose') { hitT += dt; v *= Math.max(0, 1 - 6 * dt); cl.rotation.x += dt * 10; y = Math.max(0, 1.2 * Math.sin(Math.min(hitT, .6) / .6 * Math.PI)); cl.position.y = y; shakeV *= .9; }
      const mv = v * dt;
      for (const s of stripes) { s.position.z += mv; if (s.position.z > 12) s.position.z -= LOOP; }
      for (const tr of trees) { tr.position.z += mv; if (tr.position.z > 12) tr.position.z -= LOOP; }
      acc += mv;
      if (acc >= spacing && !g.result) { acc -= spacing; spawnRow(-60 + acc); }
      for (const p of pool) if (p.on) {
        p.z += mv; p.o.position.z = p.z;
        if (p.kind === 0) p.parts[0].rotation.x -= mv / .95; else if (p.kind === 1) p.parts[1].rotation.x -= mv / .7;
        if (p.z > 6) { p.on = false; p.o.visible = false; if (!g.result) passN++; }
        else if (!g.result && p.z > -1.05 && p.z < 1.05 && Math.abs(p.x - cx) < 1.2 && !(p.kind === 2 && y > .8)) {
          g.result = 'lose'; hitT = 0; sfx.thud(); sfx.buzz(); shake(12, .4); shakeV = .5;
          const sp2 = _td3.scr(S, cx, 1.2, 0);
          burst(sp2.x, sp2.y, '#FFE14D', 22, 360); ring(sp2.x, sp2.y, '#fff', 130, .45); floatText('OUCH!', sp2.x, sp2.y - 70, '#ff6a5a', 48);
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
      }
      shakeV *= Math.max(0, 1 - 8 * dt);
      const cam = S.camera;
      cam.position.x += (cx * .55 - cam.position.x) * Math.min(1, 6 * dt);
      cam.position.y = 4.6 + Math.sin(rt * 14) * .04 + y * .3;
      cam.position.z = 7.4;
      if (shakeV > .01) T3.shakeCam(S, shakeV);
      cam.lookAt(cam.position.x * .6, 1.2, -9);
    },
    draw(t) {
      T3.render(S);
      // speed lines
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a = i * .83 + 1, r = 280 + ((now * 400 + i * 97) % 200), r2 = r + 40;
        ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * r * 1.2, 240 + Math.sin(a) * r * .8); ctx.lineTo(W / 2 + Math.cos(a) * r2 * 1.2, 240 + Math.sin(a) * r2 * .8); ctx.stroke();
      }
      if (TOUCH && !g.result && t < 2) { ctx.globalAlpha = .35; txt('<', 90, H / 2, 90, '#fff'); txt('>', W - 90, H / 2, 90, '#fff'); txt('^', W / 2, H / 2, 90, '#fff'); ctx.globalAlpha = 1; }
      vignette(.3);
    },
  };
  return g;
}, 'Lane Run');

/* ───────────── 3. CLAW MACHINE ───────────── */
reg3('td_crane', sp => {
  _td3.init();
  const S = T3.scene({ bg: 0xffd0e6, cam: [0, 5, 16.5], look: [0, 3.6, 0], fov: 50, ground: 0xffeaf3, sun: [6, 16, 10] });
  S.floor.position.y = -3.02;
  const M = T3.mk;
  T3.box(S, 16, 3, 6, 0xff4f9a, [0, -1.5, 0]);                        // cabinet; its top (y=0) is the play floor
  T3.box(S, 16, 10, .3, 0x9ad8ff, [0, 5, -3.1]);                      // back wall
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) T3.box(S, .5, 9.6, .5, 0xffd84a, [sx * 7.9, 4.8, sz * 2.9]);
  T3.box(S, 16.6, 1.6, 6.6, 0xff4f9a, [0, 10.4, 0]);
  T3.box(S, 15.2, .35, .35, 0xb8b0c8, [0, 9, 0]);                      // rail
  for (let i = 0; i < 9; i++) T3.sphere(S, .25, i % 2 ? 0xffe14d : 0xffffff, [-7 + i * 1.75, 9.6, 3.2], 1.12);
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
    for (const ex of [-.32, .32]) { const e = new THREE.Mesh(new THREE.BoxGeometry(.2, .26, .1), new THREE.MeshBasicMaterial({ color: 0x14101c })); e.position.set(ex, 2.0, .6); gr.add(e); }
    const nose = new THREE.Mesh(new THREE.BoxGeometry(.2, .14, .1), new THREE.MeshBasicMaterial({ color: 0x14101c })); nose.position.set(0, 1.78, .74); gr.add(nose);
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
  // claw
  const claw = new THREE.Group(), prongs = [];
  const hub = M.cyl(.4, .4, .5, 0xdddde8); claw.add(hub);
  const hub2 = M.sphere(.28, 0xff4f9a); hub2.position.y = .35; claw.add(hub2);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3, pv = new THREE.Group();
    pv.position.set(Math.cos(a) * .35, -.2, Math.sin(a) * .35); pv.rotation.y = -a;
    const arm = M.box(.2, 1.0, .24, 0xe9e9f4); arm.position.y = -.5; pv.add(arm);
    const tip = M.box(.2, .55, .22, 0xffd84a); tip.position.set(-.05, -.5, 0); tip.rotation.z = .6; tip.position.y = -.88; tip.position.x = -.14; pv.add(tip);
    claw.add(pv); prongs.push(pv);
  }
  T3.add(S, claw, [0, 8.2, 0]);
  const trolley = T3.box(S, 1.1, .55, 1.1, 0xff4f9a, [0, 9, 0]);
  const cable = M.cyl(.06, .06, 1, 0x333344, 1.3); T3.add(S, cable, [0, 8.6, 0]);
  const spot = new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, .03, 20), new THREE.MeshBasicMaterial({ color: 0x14101c, transparent: true, opacity: .28 }));
  spot.position.set(0, .12, 0); S.scene.add(spot);
  const TOP = 8.2, LOW = 3.7, SLIM = 6.7, CHUTE = -6.4;
  let cx = 0, tx = 0, hy = TOP, st = 'idle', pend = false, open = 1, ct = 0, held = null, slipH = 0, hang = 0, camShake = 0, tsec = 0;
  const vDown = 5 + 1.5 * (sp - 1), vUp = 5.5 + 1.5 * (sp - 1), vX = 11;
  _td3.init();
  const planeX = p => {
    S.ray.setFromCamera(new THREE.Vector2(p.x / W * 2 - 1, -(p.y / H) * 2 + 1), S.camera);
    const h = S.ray.ray.intersectPlane(_td3.P, _td3.V); return h ? _td3.cl(h.x, -SLIM, SLIM) : tx;
  };
  const clank = () => { snd(180, .08, 'square', .09, 0, 90); snd(1500, .04, 'square', .05); noise(.07, .06, 2500, 7000, 'highpass'); sfx.hit(); camShake = .12; };
  const drop = () => { if (st !== 'idle') return; st = 'down'; sfx.whoosh(false); sfx.tick(); };
  const g = {
    cmd: 'GRAB!', hint: 'MOVE + CLICK / ARROWS + SPACE', thint: 'TAP WHERE TO GRAB', dur: 9,
    key(e) { if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'Enter') { if (st === 'idle') pend = true; } },
    move(p) { if (st === 'idle' && !pend) tx = planeX(p); },
    down(p) { if (st === 'idle' && !g.result) { tx = planeX(p); pend = true; } },
    update(dt, t) {
      S.t = t; tsec += dt;
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
        if (held && hy > slipH) { held.st = 2; held.vy = 0; held = null; slipH = 99; open = .6; sfx.miss(); const s = _td3.scr(S, cx, hy - 2, 0); floatText('OOPS!', s.x, s.y, '#ff6a5a', 40); shake(4, .15); }
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
            if (p.y < -.3 && p.m.visible) {
              p.m.visible = false; p.st = 3;
              if (!g.result) {
                g.result = 'win'; const s = _td3.scr(S, CHUTE, 1, 1);
                sfx.thud(); sfx.coin(); sfx.sparkle(); confetti(W / 2, 260, 55); burst(s.x, s.y, '#FFE14D', 26, 380); ring(s.x, s.y, '#fff', 140, .5); floatText('PRIZE!', W / 2, 150, '#FFE14D', 56); shake(7, .3);
              }
            }
          } else if (p.y <= 0) { p.y = 0; if (p.vy < -3) { sfx.thud(); camShake = .08; } p.vy = 0; p.st = 0; }
        }
        p.m.position.set(p.x, p.y, p.z);
      }
      claw.position.set(cx, hy, 0);
      trolley.position.x = cx;
      cable.position.set(cx, (9 + hy) / 2 + .2, 0); cable.scale.y = 9 - hy - .2;
      const ang = -.3 + open * .95;
      for (const pv of prongs) pv.rotation.z = ang;
      spot.position.x = cx; spot.visible = st === 'idle' || st === 'down';
      claw.rotation.y = Math.sin(tsec * 3) * .05;
      camShake *= Math.max(0, 1 - 10 * dt);
      const cam = S.camera;
      cam.position.x += (cx * .12 - cam.position.x) * Math.min(1, 4 * dt);
      cam.position.y = 5; if (camShake > .01) T3.shakeCam(S, camShake);
      cam.lookAt(cam.position.x * .5, 3.6, 0);
    },
    draw(t) {
      T3.render(S);
      if (st === 'idle' && !g.result) {
        const s = _td3.scr(S, cx, 1.2, 0);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.globalAlpha = .6 + .3 * Math.sin(t * 8);
        ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, s.y - 150); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
      const ch = _td3.scr(S, CHUTE, .4, 1.4);
      txt('EXIT', ch.x, ch.y + 4, 22, '#ffd84a', 'center', 90);
      vignette(.25);
    },
  };
  return g;
}, 'Claw Grab');

/* ───────────── 4. LAVA HOP ───────────── */
let _starGeo = null;
reg3('td_hop', sp => {
  _td3.init();
  const S = T3.scene({ bg: 0x7fd0ff, fog: [28, 80], cam: [-3.5, 6.5, 11], look: [3, .5, 0], sun: [8, 16, 7] });
  const lava = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshBasicMaterial({ color: 0xff5a22 }));
  lava.rotation.x = -Math.PI / 2; lava.position.y = -3; S.scene.add(lava);
  const SP = 5, n = 4 + (sp > 1.5), M = T3.mk;
  const bubbles = [];
  for (let i = 0; i < 10; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(.5, 10, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffd23f : 0xff8a3c }));
    b.userData = { bx: -4 + Math.random() * (n * SP + 10), bz: (Math.random() - .5) * 14, ph: Math.random() * 6, f: 1 + Math.random() };
    b.position.set(b.userData.bx, -3, b.userData.bz); S.scene.add(b); bubbles.push(b);
  }
  const COLS = [0xff7ac6, 0x6ee7b7, 0xffd84a, 0xa99bff, 0xff9a5a];
  const plats = [];
  for (let i = 0; i <= n; i++) {
    const last = i === n, w = i === 0 ? 3.6 : last ? 3.8 : Math.max(2.5, 3.1 - .35 * (sp - 1));
    const col = last ? 0xffd23f : i === 0 ? 0x9be36a : COLS[i % COLS.length];
    const gr = new THREE.Group(), top = M.box(w, .6, 3, col); gr.add(top);
    const rock = M.cone(1.1, 1.8, 0x8a6a5a); rock.position.y = -1.2; rock.rotation.x = Math.PI; rock.scale.set(w / 3, 1, 1); gr.add(rock);
    const bx = i * SP, bz = i === 0 || last ? 0 : (i % 2 ? .5 : -.5);
    T3.add(S, gr, [bx, 0, bz]);
    const mov = i >= 2 && !last && (i % 2 === 0 || sp > 1.4);
    plats.push({ gr, w, bx, bz, x: bx, amp: mov ? 1.0 + .5 * (sp - 1) : 0, spd: 1.3 + .6 * Math.random() + .4 * (sp - 1), ph: Math.random() * 6.28 });
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
  const CS = .42, cl = T3.claude(S, CS, OR, [0, .3, 0]); cl.rotation.y = .6;
  const VX = 7, VY = 9.2, GR = 26, TOPY = .3, AIR = 2 * VY / GR, REACH = VX * AIR;
  let cx = 0, cy = TOPY, cz = 0, vy = 0, air = false, on = 0, sq = 0, camx = 0, lookx = 3, camShake = 0, tsec = 0, done = 0, sink = 0, ft = 0;
  const jump = () => { if (air || g.result) return; air = true; vy = VY; sq = -1; sfx.boing(); sfx.whoosh(true); };
  const g = {
    cmd: 'HOP!', hint: 'SPACE / CLICK: HOP TO THE STAR', thint: 'TAP TO HOP TO THE STAR', dur: 8,
    key(e) { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowRight' || e.code === 'KeyW' || e.code === 'KeyD') jump(); },
    down() { jump(); },
    update(dt, t) {
      S.t = t; tsec += dt;
      for (let i = 0; i < plats.length; i++) {
        const p = plats[i], nx = p.bx + p.amp * Math.sin(tsec * p.spd + p.ph), d = nx - p.x; p.x = nx;
        p.gr.position.x = nx; p.gr.position.y = Math.sin(tsec * 1.5 + i) * .05;
        if (!air && on === i && !done) cx += d;
      }
      for (const b of bubbles) { const u = b.userData, k = Math.abs(Math.sin(tsec * u.f + u.ph)); b.position.y = -3.1 + k * .9; b.scale.setScalar(.3 + k); }
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
            sink = 1;
          }
        }
      }
      if (sink) { cy -= dt * 2; }
      if (g.result === 'win') { cl.rotation.y += dt * 8; cl.armL.position.y = cl.armR.position.y = 1.9 + Math.sin(tsec * 20) * .2; }
      else cl.rotation.y += (.6 - cl.rotation.y) * Math.min(1, 10 * dt);
      sq *= Math.max(0, 1 - 9 * dt);
      const stretch = air ? Math.min(.25, Math.abs(vy) * .02) : 0;
      cl.scale.set(CS * (1 - stretch * .6 + (sq > 0 ? sq * .25 : 0)), CS * (1 + stretch - (sq > 0 ? sq * .3 : 0)), CS * (1 - stretch * .6 + (sq > 0 ? sq * .25 : 0)));
      cl.position.set(cx, cy, cz);
      cl.legs.forEach((l, i) => { l.rotation.x = air ? Math.sin(tsec * 18 + i) * .5 : 0; });
      if (!air && !g.result) { const bob = Math.sin(tsec * 6) * .03; cl.body.position.y = 1.65 + bob; }
      marker.visible = !air && !g.result; marker.position.set(cx + REACH, TOPY + .06, cz); marker.scale.setScalar(1 + Math.sin(tsec * 8) * .1);
      // camera
      camx += (cx - camx) * Math.min(1, 3 * dt); lookx += (cx + 3.5 - lookx) * Math.min(1, 3 * dt);
      camShake *= Math.max(0, 1 - 9 * dt);
      const cam = S.camera; cam.position.set(camx - 3.5, 6.5 + (air ? .2 : 0), 11);
      if (camShake > .01) T3.shakeCam(S, camShake);
      cam.lookAt(lookx, .5, 0);
    },
    draw(t) {
      T3.render(S);
      if (!air && !g.result && t < 2) txt(TOUCH ? 'TAP!' : 'SPACE!', W / 2, 500, 38, '#fff', 'center', 300);
      vignette(.25);
    },
  };
  return g;
}, 'Lava Hop');
