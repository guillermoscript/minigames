'use strict';
/* 3D wave 1: td_stack, td_bowl, td_dive, td_hoop. Everything lives in an IIFE so helper names never leak into the shared global scope. */
(() => {
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const dotsBar = (n, need, y = 556) => {          // progress pips along the bottom
    for (let i = 0; i < need; i++) { circ(W / 2 + (i - (need - 1) / 2) * 44, y, 15, i < n ? '#FFE14D' : 'rgba(255,255,255,.55)', 4); }
  };

  /* ───────────── 1. STACK ───────────── */
  reg3('td_stack', sp => {
    const NEED = 4 + (sp > 1.35 ? 1 : 0) + (sp > 1.75 ? 1 : 0), CH = .6, AMP = 4.2;
    const PAL = [0xff7755, 0xffc93c, 0x5fd38d, 0x4fb3ff, 0xb98cff, 0xff8ac2];
    const S = T3.scene({ bg: 0x8fd8ff, fog: [28, 75], cam: [7, 5, 9], look: [0, 1.5, 0], ground: 0x84d86b, sun: [6, 14, 8] });
    T3.box(S, 4, .3, 4, 0xeadbb8, [0, -.1, 0]);                       // pallet under the first crate
    const fall = [];
    const top = { x: 0, z: 0, w: 3, d: 3 };
    T3.box(S, 3, CH, 3, PAL[0], [0, CH / 2, 0]);
    const spec = T3.claude(S, .5, OR, [-5.2, 0, 3]); spec.rotation.y = .7;
    let placed = 0, ph = -Math.PI / 2, camY = 0, t0 = .35, cur = null, bounce = 0;
    const axisX = () => (placed % 2) === 0;
    const spawn = () => {
      const x = axisX();
      cur = T3.box(S, top.w, CH, top.d, PAL[(placed + 1) % PAL.length], [x ? 0 : top.x, CH / 2 + (placed + 1) * CH, x ? top.z : 0]);
      ph = -Math.PI / 2;
    };
    spawn();
    const addFall = (m, vx, vz) => { fall.push({ m, vy: 0, vx, vz, rx: rnd(-2, 2), rz: rnd(-2, 2) }); };
    const chunk = (w, d, x, y, z, c, vx, vz) => { addFall(T3.box(S, w, CH, d, c, [x, y, z]), vx, vz); };
    const note = (s, col) => { const q = T3.screen(S, cur.position); floatText(s, q.x, q.y - 30, col, 38); };
    const drop = () => {
      if (g.result || t0 > 0 || !cur) return;
      const x = axisX(), a = AMP * Math.sin(ph), c = x ? top.x : top.z, s = x ? top.w : top.d;
      const lo = Math.max(a - s / 2, c - s / 2), hi = Math.min(a + s / 2, c + s / 2), ov = hi - lo, y = cur.position.y;
      const col = PAL[(placed + 1) % PAL.length];
      if (ov < .08) {                                                 // total miss
        addFall(cur, 0, 0); cur.position.set(x ? a : top.x, y, x ? top.z : a);
        sfx.miss(); sfx.buzz(); shake(8, .3); g.result = 'lose';
        const q = T3.screen(S, cur.position); floatText('MISS!', q.x, q.y, '#ff5a5a', 44); return;
      }
      const perfect = Math.abs(a - c) < .13;
      let nc = (lo + hi) / 2, ns = ov;
      if (perfect) { nc = c; ns = s; } else {
        const cut = s - ov, side = a > c ? 1 : -1;
        const cx = a > c ? hi + cut / 2 : lo - cut / 2;
        chunk(x ? cut : top.w, x ? top.d : cut, x ? cx : top.x, y, x ? top.z : cx, col, x ? side * 2 : 0, x ? 0 : side * 2);
      }
      S.scene.remove(cur); cur.geometry.dispose();
      const w = x ? ns : top.w, d = x ? top.d : ns, px = x ? nc : top.x, pz = x ? top.z : nc;
      cur = T3.box(S, w, CH, d, col, [px, y, pz]);
      top.x = px; top.z = pz; top.w = w; top.d = d; placed++; bounce = .12;
      const q = T3.screen(S, cur.position);
      if (perfect) { sfx.sparkle(); sfx.coin(); ring(q.x, q.y, '#FFE14D', 110); burst(q.x, q.y, '#FFE14D', 16); floatText('PERFECT!', q.x, q.y - 40, '#FFE14D', 40); spec.position.y = .6; }
      else { sfx.thud(); sfx.hit(); burst(q.x, q.y, '#fff', 8, 160); shake(3, .12); }
      if (placed >= NEED) {
        g.result = 'win'; sfx.sparkle(); ring(q.x, q.y, '#fff', 140); burst(q.x, q.y - 20, '#FFE14D', 22);
        const h = T3.claude(S, .35, OR, [px, y + CH / 2, pz]); h.armL.position.y = 2; h.armR.position.y = 2; cur.userData.h = h;
      } else spawn();
    };
    const g = {
      cmd: 'STACK!', hint: 'CLICK / SPACE TO DROP', thint: 'TAP TO DROP', dur: 7,
      update(dt, t) {
        if (t0 > 0) t0 -= dt;
        if (!g.result && cur) {
          ph += dt * (2.1 + .28 * placed) * (.9 + .35 * (sp - 1));
          const a = AMP * Math.sin(ph);
          if (axisX()) cur.position.x = a; else cur.position.z = a;
        }
        for (let i = fall.length - 1; i >= 0; i--) {
          const f = fall[i]; f.vy -= 26 * dt; f.m.position.y += f.vy * dt; f.m.position.x += f.vx * dt; f.m.position.z += f.vz * dt;
          f.m.rotation.x += f.rx * dt; f.m.rotation.z += f.rz * dt;
          if (f.m.position.y < -9) { S.scene.remove(f.m); fall.splice(i, 1); }
        }
        bounce = Math.max(0, bounce - dt);
        const ty = CH * placed; camY += (ty - camY) * Math.min(1, dt * 4);
        S.camera.position.set(7, camY + 5 + bounce * .4, 9); S.camera.lookAt(0, camY + 1.3, 0);
        spec.position.y = Math.max(0, spec.position.y - dt * 4); spec.rotation.y = .7 + Math.sin(t * 3) * .2;
        spec.armL.position.y = 1.45 + Math.max(0, Math.sin(t * 8)) * .4; spec.armR.position.y = 1.45 + Math.max(0, Math.sin(t * 8 + 2)) * .4;
        if (cur && cur.userData.h) { cur.userData.h.rotation.y = Math.sin(t * 4) * .4; cur.userData.h.position.y = cur.position.y + CH / 2 + Math.abs(Math.sin(t * 8)) * .25; }
      },
      down() { drop(); }, key(e) { if (e.code === 'Space' || e.code === 'Enter') drop(); },
      draw() {
        T3.render(S);
        txt(placed + ' / ' + NEED, W / 2, 540, 44, '#fff'); dotsBar(placed, NEED, 570);
      }
    };
    return g;
  }, 'Stack');

  /* ───────────── 2. BOWL ───────────── */
  reg3('td_bowl', sp => {
    const S = T3.scene({ bg: 0x4a3b86, fog: [18, 40], cam: [0, 2.7, 8.8], look: [0, .8, -8], ground: 0x2d2352, sun: [3, 10, 4], fov: 50 });
    const BR = .48, PR = .22, HEADZ = -9, BZ0 = 3;
    T3.box(S, 3, .2, 19, 0xf3c98b, [0, -.1, -3]);
    for (const s of [-1, 1]) { T3.box(S, .5, .2, 19, 0x4a3b7a, [s * 1.75, -.2, -3]); T3.box(S, .4, 1.2, 19, 0xff6f91, [s * 2.2, .4, -3]); }
    for (let i = 0; i < 7; i++) T3.box(S, .12, .02, .5, 0x8a5a2b, [(i - 3) * .36, .01, .8 + Math.abs(i - 3) * .4]);
    T3.box(S, 5.2, 1.6, .5, 0x1b1432, [0, .5, -13.2]);
    T3.box(S, 3, .05, 1.2, 0x1b1432, [0, -.18, -12.6]);
    const x0 = (Math.random() < .5 ? -1 : 1) * rnd(.7, 1.05);
    const ball = T3.sphere(S, BR, 0x3a7bff, [x0, BR, BZ0], 1.06);
    const hole = (a, b) => { const m = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0x14101c })); m.position.set(.2 * a, .38 * b, -.38); ball.add(m); };
    hole(-.5, .3); hole(.5, .3); hole(0, .9);
    const pins = [];
    const axis = new THREE.Vector3(0, 0, 0);
    for (let r = 0; r < 4; r++) for (let k = 0; k <= r; k++) {
      const gp = new THREE.Group(), M = T3.mk;
      const b = M.cyl(.15, .21, .6, 0xfff6e0); b.position.y = .3; gp.add(b);
      const n = M.cyl(.1, .15, .3, 0xfff6e0); n.position.y = .72; gp.add(n);
      const h = M.sphere(.13, 0xfff6e0); h.position.y = .98; gp.add(h);
      const st = M.cyl(.105, .12, .07, 0xe8433a, 1.1); st.position.y = .8; gp.add(st);
      const x = (k - r / 2) * .64, z = HEADZ - r * .56;
      T3.add(S, gp, [x, 0, z]);
      pins.push({ m: gp, x, z, vx: 0, vz: 0, st: 0, tilt: 0, ax: 0, az: 0 });
    }
    const bl = { x: x0, z: BZ0, vx: 0, vz: 0, y: BR, spin: 0 };
    let phase = 'aim', drag = null, ang = 0, charge = 0, charging = false, kt = 0, settle = 0, hitSfx = 0, down = 0, camZ = 8.8, camX = 0, ballSc = null;
    const knock = (p, vx, vz) => {
      if (p.st) return; p.st = 1; p.vx = vx; p.vz = vz; const l = Math.hypot(vx, vz) || 1; p.ax = vz / l; p.az = -vx / l; down++;
      if (hitSfx <= 0) { sfx.hit(); sfx.thud(); hitSfx = .06; } else sfx.tick();
      const q = T3.screen(S, p.m.position); burst(q.x, q.y - 40, '#fff', 4, 150);
    };
    const launch = (pw, a) => {
      const v = 9 + 14 * pw; ang = a; bl.vx = Math.sin(a) * v; bl.vz = -Math.cos(a) * v; phase = 'roll'; sfx.whoosh(true); drag = null; charging = false;
    };
    const pwOf = dy => cl((dy - 8) / 170, .12, 1);
    const g = {
      cmd: 'BOWL!', hint: 'DRAG BACK, RELEASE', thint: 'DRAG BACK, LET GO', dur: 7,
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
        for (const p of pins) if (p.st) {
          p.x += p.vx * dt; p.z += p.vz * dt; const f = Math.exp(-1.7 * dt); p.vx *= f; p.vz *= f;
          if (p.z < -12.2) { p.z = -12.2; p.vz *= -.3; } if (Math.abs(p.x) > 2.1) { p.x = Math.sign(p.x) * 2.1; p.vx *= -.4; }
          p.tilt = Math.min(Math.PI / 2, p.tilt + dt * 6);
          axis.set(p.ax, 0, p.az); p.m.quaternion.setFromAxisAngle(axis, p.tilt); p.m.position.set(p.x, p.tilt > 1.4 ? .12 : 0, p.z);
        }
        if (phase !== 'aim') bl.spin -= Math.hypot(bl.vx, bl.vz) * dt / BR;
        ball.position.set(bl.x, bl.y, bl.z); ball.rotation.x = bl.spin;
        const tz = Math.max(bl.z + 6.2, -2.6), tx = bl.x * .45;
        camZ += (tz - camZ) * Math.min(1, dt * 6); camX += (tx - camX) * Math.min(1, dt * 5);
        S.camera.position.set(camX, 2.7 - (8.8 - camZ) * .045, camZ);
        S.camera.lookAt(camX * .6, .7, Math.max(bl.z - 9, HEADZ - 3));
      },
      draw(t) {
        T3.render(S);
        if (phase === 'aim') {
          const a = T3.screen(S, ball.position), px = bl.x + Math.sin(ang) * 11, pz = bl.z - Math.cos(ang) * 11;
          const b = T3.screen(S, S.camera.position.clone().set(px, .6, pz));
          ctx.save(); ctx.setLineDash([16, 12]); ctx.lineCap = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.lineWidth = 3.5; ctx.strokeStyle = '#FFE14D'; ctx.stroke(); ctx.restore();
          let pw = -1; if (drag) pw = (drag.cy - drag.sy) > 14 ? pwOf(drag.cy - drag.sy) : 0; else if (charging) pw = .3 + .7 * (1 - Math.cos(kt * 5)) / 2;
          if (pw >= 0) { box(W - 70, 180, 30, 260, 'rgba(20,16,28,.6)', 4); box(W - 70, 180 + 260 * (1 - pw), 30, 260 * pw, pw > .85 ? '#ff5a5a' : '#5fd38d', 3); txt('POWER', W - 55, 160, 22, '#fff'); }
          if (drag) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(drag.sx, drag.sy); ctx.lineTo(drag.cx, drag.cy); ctx.stroke(); circ(drag.cx, drag.cy, 10, '#fff', 3); }
        } else if (phase !== 'aim') txt(window.t('{n} DOWN', { n: down }), 90, 548, 38, '#fff');
      }
    };
    return g;
  }, 'Bowl');

  /* ───────────── 3. DIVE ───────────── */
  reg3('td_dive', sp => {
    const NEED = 3 + (sp > 1.6 ? 1 : 0), RR = 2.7 - (sp - 1) * .2, SPD = 20 + 6 * (sp - 1), GAP = 20;
    const S = T3.scene({ bg: 0x6cc4ff, fog: [30, 95], cam: [0, 7, 11], look: [0, -6, 0], sun: [4, 20, 8] });
    S.sun.castShadow = false;
    const gnd = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), T3.mat(0x7fd36b)); gnd.rotation.x = -Math.PI / 2; gnd.position.y = -100; S.scene.add(gnd);
    const P = new THREE.Group(), cl3 = T3.claude(null, .5, OR); cl3.position.set(0, -1.1, 0); P.add(cl3); P.rotation.x = .47; T3.add(S, P, [0, 0, 0]); P.traverse(m => { m.castShadow = false; });
    const clouds = [];
    for (let i = 0; i < 16; i++) {
      const c = new THREE.Group(), M = T3.mk;
      [[0, 0, 0, 1.6], [1.5, -.2, .2, 1.2], [-1.4, -.1, -.2, 1.3]].forEach(q => { const s = M.sphere(q[3], 0xffffff, 1.05); s.position.set(q[0], q[1], q[2]); c.add(s); });
      c.position.set((Math.random() < .5 ? -1 : 1) * rnd(5, 16), rnd(-60, 10), rnd(-10, 1)); S.scene.add(c); clouds.push(c);
    }
    const streaks = [], smat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55 }), sgeo = new THREE.BoxGeometry(.06, 4, .06);
    for (let i = 0; i < 14; i++) { const s = new THREE.Mesh(sgeo, smat); s.position.set((Math.random() < .5 ? -1 : 1) * rnd(1.5, 9), rnd(-20, 10), rnd(-6, 5)); S.scene.add(s); streaks.push(s); }
    const rings = [];
    for (let i = 0; i < 6; i++) {
      const m = T3.torus(S, RR, .28, 0xffc93c, [0, -999, 0], [Math.PI / 2, 0, 0]); m.visible = false; m.castShadow = false;
      rings.push({ m, on: false, st: 0, x: 0, z: 0, y: -999, a: 0, mat: m.material });
    }
    let got = 0, tgt = { x: 0, z: 0 }, pos = { x: 0, z: 0 }, vx = 0, spawnT = 0, nextX = 0, nextZ = 0, camX = 0, shk = 0, first = true, lastRingMiss = 0;
    const R = { x: 5.2, z: 2 }, kd = {};
    const spawnRing = () => {
      const r = rings.find(q => !q.on); if (!r) return;
      nextX = cl(nextX + rnd(-4.5, 4.5), -R.x, R.x); nextZ = cl(nextZ + rnd(-1.5, 1.5), -R.z, R.z); // depth is hard to read from above, so keep it gentle
      r.on = true; r.st = 0; r.x = nextX; r.z = nextZ; r.y = first ? -22 : -40; first = false; r.a = 0;
      r.m.visible = true; r.m.scale.setScalar(1); r.mat.transparent = false; r.mat.opacity = 1; r.mat.color.setHex(0xffc93c);
    };
    const setT = p => { tgt.x = cl((p.x / W - .5) * 2 * R.x, -R.x, R.x); tgt.z = cl((p.y / H - .5) * 2 * R.z, -R.z, R.z); };
    const g = {
      cmd: 'DIVE!', hint: 'STEER THROUGH THE RINGS', thint: 'DRAG TO STEER', dur: 7,
      move(p) { setT(p); }, down(p) { setT(p); },
      key(e) { kd[e.code] = 1; }, keyup(e) { kd[e.code] = 0; },
      update(dt, t) {
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
                r.st = 1; got++; const q = T3.screen(S, P.position);
                sfx.coin(); sfx.sparkle(); ring(q.x, q.y, '#FFE14D', 120); burst(q.x, q.y, '#FFE14D', 16); floatText('+1', q.x, q.y - 50, '#fff', 44); shk = .35; r.mat.color.setHex(0x5fe08a); r.mat.transparent = true;
                if (got >= NEED) { g.result = 'win'; sfx.sparkle(); }
              } else { r.st = 2; r.mat.color.setHex(0xff5a5a); sfx.miss(); lastRingMiss = .5; }
            }
          } else if (r.st === 1) { r.a += dt * 2.5; r.m.scale.setScalar(1 + r.a * 1.2); r.mat.opacity = Math.max(0, 1 - r.a); if (r.a >= 1) { r.on = false; r.m.visible = false; } }
          if (r.y > 14) { r.on = false; r.m.visible = false; }
        }
        for (const c of clouds) { c.position.y += SPD * dt; if (c.position.y > 14) c.position.set((Math.random() < .5 ? -1 : 1) * rnd(5, 16), -62 - Math.random() * 10, rnd(-10, 1)); }
        for (const s of streaks) { s.position.y += SPD * 1.7 * dt; if (s.position.y > 12) s.position.set((Math.random() < .5 ? -1 : 1) * rnd(1.5, 9), -22, rnd(-6, 5)); }
        gnd.position.y = -100 + t * 11;
        camX += (pos.x * .55 - camX) * Math.min(1, dt * 4); shk = Math.max(0, shk - dt);
        S.camera.position.set(camX, 7, 11); S.camera.lookAt(camX, -6, 0); if (shk > 0) T3.shakeCam(S, shk * .6);
        lastRingMiss = Math.max(0, lastRingMiss - dt);
      },
      draw() {
        T3.render(S);
        txt(got + ' / ' + NEED, W / 2, 540, 44, '#fff'); dotsBar(got, NEED, 575);
        if (lastRingMiss > 0) txt('MISSED!', W / 2, 300, 46, '#ff5a5a');
        vignette(.25);
      }
    };
    return g;
  }, 'Dive');

  /* ───────────── 4. HOOP ───────────── */
  reg3('td_hoop', sp => {
    const NEED = sp > 1.6 ? 2 : 1, HX = 0, HY = 3.3, HZ = -8.2, RIMR = .62, BRD = .3, BOARDZ = -8.95, GRAV = 18, T = 1.1;
    const SENS = .28 + .12 * (sp - 1), SWEET = .61;
    const S = T3.scene({ bg: 0x8fd3ff, fog: [20, 48], cam: [0, 2.6, 6.5], look: [0, 3, -4], ground: 0xe8a85c, sun: [4, 14, 5], fov: 55 });
    T3.box(S, 4, .03, 6.2, 0xd9573f, [0, .02, -6.1], null, 1.0);
    T3.torus(S, 1.8, .05, 0xffffff, [0, .05, -3], [Math.PI / 2, 0, 0], 1.0);
    T3.box(S, 30, .03, .12, 0xffffff, [0, .03, -12], null, 1.0);
    T3.cyl(S, .16, .2, 3.6, 0x8a8aa6, [0, 1.8, -10.3]);
    T3.box(S, .25, .25, 1.4, 0x8a8aa6, [0, 3.2, -9.7]);
    T3.box(S, 3.6, 2.0, .14, 0xffffff, [0, 3.7, BOARDZ]);
    T3.box(S, 1.3, .95, .05, 0xe8433a, [0, 3.35, BOARDZ + .09], null, 1.0);
    T3.torus(S, RIMR, .06, 0xff6a2b, [HX, HY, HZ], [Math.PI / 2, 0, 0], 1.12);
    const net = new THREE.Mesh(new THREE.CylinderGeometry(RIMR * .96, RIMR * .6, .75, 12, 3, true), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true }));
    net.position.set(HX, HY - .4, HZ); S.scene.add(net);
    const rimPts = []; for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2; rimPts.push([HX + Math.cos(a) * RIMR, HZ + Math.sin(a) * RIMR]); }
    const ball = T3.sphere(S, BRD, 0xff8a2b, [0, .95, 1.8], 1.09);
    const lm = new THREE.MeshBasicMaterial({ color: 0x14101c });
    for (const rx of [0, Math.PI / 2]) { const l = new THREE.Mesh(new THREE.TorusGeometry(BRD + .005, .018, 6, 20), lm); l.rotation.y = rx; ball.add(l); }
    const b = { x: 0, y: .95, z: 1.8, vx: 0, vy: 0, vz: 0 };
    let st = 'ready', flightT = 0, scored = 0, rimHit = 0, rimTouch = false, bounced = 0, readyT = 0, wob = 0, zoom = 0, camShake = 0, restT = 0;
    let pressed = false, hold = 0, drag = null, metering = false, mt = 0, aimX = W / 2, kHeld = false, spin = 0;
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
      cmd: 'SHOOT!', hint: 'FLICK UP TO SHOOT', thint: 'SWIPE UP TO SHOOT', dur: 7,
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
              ball.userData.counted = 1; scored++; wob = 1; zoom = 1; camShake = .25;
              const q = T3.screen(S, ball.position); sfx.coin(); sfx.sparkle(); sfx.pop(); shake(5, .2);
              ring(q.x, q.y, '#FFE14D', 120); burst(q.x, q.y, '#FFE14D', 18); burst(q.x, q.y, '#ff8a2b', 10, 200);
              floatText(rimTouch ? 'NICE!' : 'SWISH!', q.x, q.y - 70, rimTouch ? '#fff' : '#FFE14D', 52);
              if (scored >= NEED) { g.result = 'win'; }
            }
          }
          spin += dt * 8; ball.position.set(b.x, b.y, b.z); ball.rotation.x -= dt * 7; ball.rotation.z += dt * 3;
          if (!g.result && (flightT > 3.4 || (bounced >= 2 && b.y <= BRD + .02) || b.z > 7 || Math.abs(b.x) > 12)) {
            if (st === 'fly') { st = 'rest'; restT = 0; }
          }
          if (st === 'rest') { restT += dt; if (restT > .35 && !g.result) { ball.userData.counted = 0; readyBall(); } }
        }
        wob = Math.max(0, wob - dt * 1.8); const w = Math.sin(t * 28) * .12 * wob;
        net.scale.set(1 + w, 1 + wob * .12 * Math.sin(t * 20), 1 + w);
        zoom = Math.max(0, zoom - dt * 1.4); camShake = Math.max(0, camShake - dt * .6);
        S.camera.position.set(b.x * .12, 2.6, 6.5 - zoom * .9); S.camera.lookAt(0, 3, -4);
        if (camShake > 0) T3.shakeCam(S, camShake);
      },
      draw() {
        T3.render(S);
        if (st === 'ready') {
          let pw = -1;
          if (pressed && drag && drag.sy - drag.cy > 20) pw = cl((drag.sy - drag.cy) / 250, 0, 1);
          else if (pressed || metering) pw = meterPw();
          const bx = W - 66, by = 170, bh = 300;
          box(bx, by, 34, bh, 'rgba(20,16,28,.55)', 4);
          const lo = SWEET - .11, hi = SWEET + .11; ctx.fillStyle = '#5fd38d'; ctx.fillRect(bx + 2, by + bh * (1 - hi), 30, bh * (hi - lo));
          if (pw >= 0) { const y = by + bh * (1 - pw); ctx.fillStyle = INK; ctx.fillRect(bx - 10, y - 5, 54, 10); ctx.fillStyle = '#fff'; ctx.fillRect(bx - 7, y - 3, 48, 6); }
          txt('POWER', bx + 17, by - 22, 22, '#fff');
          if (pressed || metering) { ctx.save(); ctx.setLineDash([10, 10]); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 4; const ax = (drag && drag.sy - drag.cy > 20) ? W / 2 + (drag.cx - drag.sx) : aimX; ctx.beginPath(); ctx.moveTo(ax, 150); ctx.lineTo(ax, 300); ctx.stroke(); ctx.restore(); }
          if (drag && pressed) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(drag.sx, drag.sy); ctx.lineTo(drag.cx, drag.cy); ctx.stroke(); }
        }
        txt(scored + ' / ' + NEED, 90, 548, 40, '#fff');
      }
    };
    return g;
  }, 'Hoop');
})();
