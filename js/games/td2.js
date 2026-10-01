'use strict';
/* 3D stage, set 2: td_tunnel (FLY!), td_mole (WHACK!), td_roll (ROLL!), td_basket (CATCH!). Wrapped in an IIFE so helpers don't leak into the shared global scope. */
(() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const dispose = o => o.traverse(m => { if (m.geometry && !m.geometry._keep) m.geometry.dispose(); });
  const torusMesh = (r, tube, c, basic) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 24), basic ? new THREE.MeshBasicMaterial({ color: c }) : T3.mat(c));
    m.rotation.x = Math.PI / 2; return m;
  };
  const pips = (n, need, y = 566) => {
    const x0 = W / 2 - (need - 1) * 22;
    for (let i = 0; i < need; i++) circ(x0 + i * 44, y, 14, i < n ? '#FFE14D' : 'rgba(255,255,255,.45)', 4);
  };
  const eoBack = u => { const c = 1.9; u -= 1; return 1 + (c + 1) * u * u * u + c * u * u; };

  /* ───────────────────────── 1. TUNNEL ───────────────────────── */
  reg3('td_tunnel', sp => {
    const S = T3.scene({ bg: 0x2a1a55, fog: [16, 72], cam: [0, 1, 2], look: [0, 0, -20], fov: 72 });
    S.sun.castShadow = false;
    const SZ = -6, SPACING = 24, NW = 6, LX = 6, LY = 4.5;
    const v0 = 30 + 9 * sp, gsBase = clamp(3.7 - .7 * (sp - 1), 2.7, 3.7);
    const BG = new THREE.BoxGeometry(1, 1, 1), GLOW = new THREE.MeshBasicMaterial({ color: 0xffe14d });
    const mats = [0xff5a8a, 0x5ac8fa, 0x7ed957, 0xffa62b].map(c => T3.mat(c));
    const box = (parent, m) => { const b = new THREE.Mesh(BG, m); parent.add(b); return b; };
    const setB = (b, x0, x1, y0, y1, z, th) => { b.scale.set(Math.max(.001, x1 - x0), Math.max(.001, y1 - y0), th); b.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); };

    let lastGx = 0, lastGy = 0, passes = 0;
    const walls = [];
    const place = (w, z) => {
      w.z = z; w.passed = false;
      w.gs = gsBase + rnd(-.2, .2);
      w.gx = clamp(lastGx + rnd(-5.5, 5.5), -4, 4); w.gy = clamp(lastGy + rnd(-3.5, 3.5), -3, 3);
      lastGx = w.gx; lastGy = w.gy;
      const { gx, gy, gs } = w, X = 10, Y = 8, p = w.pan, f = w.fr;
      setB(p[0], -X, gx - gs, -Y, Y, 0, 1);
      setB(p[1], gx + gs, X, -Y, Y, 0, 1);
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
      const w = { g, pan: [0, 1, 2, 3].map(() => box(g, m)), fr: [0, 1, 2, 3].map(() => box(g, GLOW)) };
      S.scene.add(g); walls.push(w); place(w, -50 - i * SPACING);
    }
    /* square rings rushing past */
    const rings = [], RN = 9, RS = 10, ringCols = [0x5ac8fa, 0xff5a8a];
    for (let i = 0; i < RN; i++) {
      const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: ringCols[i % 2] });
      setB(box(g, m), -10.3, 10.3, 7.7, 8.0, 0, .3); setB(box(g, m), -10.3, 10.3, -8.0, -7.7, 0, .3);
      setB(box(g, m), -10.3, -10, -8, 8, 0, .3); setB(box(g, m), 10, 10.3, -8, 8, 0, .3);
      g.position.z = 3 - i * RS; S.scene.add(g); rings.push(g);
    }
    /* streaking lights */
    const streaks = [], SM = [0xffffff, 0x9ff3ff, 0xffd1f0].map(c => new THREE.MeshBasicMaterial({ color: c }));
    for (let i = 0; i < 40; i++) {
      const b = box(S.scene, SM[i % 3]); b.scale.set(.1, .1, 4);
      b.position.set(rnd(-9.5, 9.5), rnd(-7.5, 7.5), rnd(-90, 3)); streaks.push(b);
    }
    /* ship = Claude on a hover board */
    const ship = T3.claude(S, .4, OR, [0, -.4, SZ]);
    const board = T3.mk.box(3.6, .22, 4.2, 0x5ac8fa); board.position.y = -.1; ship.add(board);
    board.castShadow = false;

    let sx = 0, sy = 0, tx = 0, ty = 0, dead = false, T = 0, vf = .75, kick = 0, camShake = 0, spin = 0, roll = 0, sdx = 0;
    const lines = Array.from({ length: 18 }, (_, i) => ({ a: i / 18 * 6.283 + rnd(-.2, .2), r: rnd(0, 1) }));

    const g = {
      cmd: 'FLY!', hint: 'STEER THROUGH THE GAPS', thint: 'DRAG TO STEER', dur: 6, timeWin: true,
      move(p) { if (dead) return; tx = (p.x / W * 2 - 1) * LX; ty = -(p.y / H * 2 - 1) * LY; },
      down(p) { g.move(p); },
      update(dt) {
        dt = Math.min(dt, .033); T += dt;
        const target = dead ? 0 : 1; vf += (target - vf) * Math.min(1, (dead ? 5 : 1.5) * dt);
        const v = v0 * vf;
        if (!dead) {
          const kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
          const ky = (keys.ArrowUp || keys.KeyW ? 1 : 0) - (keys.ArrowDown || keys.KeyS ? 1 : 0);
          if (kx || ky) { tx = clamp(tx + kx * 13 * dt, -LX, LX); ty = clamp(ty + ky * 10 * dt, -LY, LY); }
          const ox = sx; sx += (tx - sx) * Math.min(1, 9 * dt); sy += (ty - sy) * Math.min(1, 9 * dt); sdx = (sx - ox) / dt;
        }
        for (const w of walls) {
          const pz = w.z; w.z += v * dt;
          if (w.z > 4) { place(w, w.z - NW * SPACING); continue; }
          w.g.position.z = w.z;
          if (!dead && !w.passed && w.z >= SZ - .3 && pz < SZ + 1) {
            w.passed = true;
            const mx = w.gs - Math.abs(sx - w.gx), my = w.gs - Math.abs(sy - w.gy);
            if (mx < .5 || my < .45) {
              dead = true; g.result = 'lose'; spin = 1; camShake = 1;
              sfx.thud(); sfx.buzz(); shake(14, .4);
              const s = T3.screen(S, ship.position); burst(s.x, s.y, '#FFE14D', 22, 340); ring(s.x, s.y, '#fff', 120, .5); floatText('CRASH!', s.x, s.y - 50, '#ff5a8a', 46);
            } else {
              passes++; sfx.blip(passes * 2); sfx.whoosh(true); kick = 1;
              if (Math.min(mx, my) < .9) { const s = T3.screen(S, ship.position); floatText('CLOSE!', s.x, s.y - 60, '#9ff3ff', 32); sfx.tickHi(); }
            }
          }
        }
        for (const r of rings) { r.position.z += v * dt; if (r.position.z > 4) r.position.z -= RN * RS; }
        for (const b of streaks) {
          b.position.z += v * 1.15 * dt;
          if (b.position.z > 4) { b.position.z -= 94; b.position.x = rnd(-9.5, 9.5); b.position.y = rnd(-7.5, 7.5); }
          b.scale.z = 3 + v * .06;
        }
        for (const l of lines) { l.r += dt * (.9 + vf); if (l.r > 1) { l.r = 0; l.a = rnd(0, 6.283); } }
        /* ship pose */
        ship.position.x = sx; ship.position.y = sy - .4;
        if (!dead) { roll += ((-sdx * .045) - roll) * Math.min(1, 10 * dt); ship.rotation.z = roll; ship.rotation.x = clamp((ty - sy) * -.05, -.3, .3) + Math.sin(T * 9) * .02; ship.rotation.y = 0; }
        else { ship.rotation.x += 7 * dt * spin; ship.rotation.z += 5 * dt * spin; ship.position.y += 1.5 * dt; spin *= .985; }
        for (let i = 0; i < 4; i++) ship.legs[i].rotation.x = Math.sin(T * 20 + i) * .5;
        ship.armL.rotation.z = Math.sin(T * 12) * .4; ship.armR.rotation.z = -Math.sin(T * 12) * .4;
        /* camera: follows the ship loosely, FOV pulses on each gap */
        kick *= Math.pow(.02, dt); camShake *= Math.pow(.03, dt);
        const c = S.camera;
        c.position.set(sx * .55 + (Math.random() - .5) * camShake * .6, sy * .55 + 1.1 + (Math.random() - .5) * camShake * .6, 2);
        c.up.set(Math.sin(roll * 1.5), Math.cos(roll * 1.5), 0);
        c.lookAt(sx * .3, sy * .3, -20);
        c.fov = 70 + 8 * vf + kick * 6 + Math.sin(T * 3) * .6; c.updateProjectionMatrix();
      },
      draw() {
        T3.render(S);
        ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineCap = 'round';
        for (const l of lines) {
          const r0 = 120 + l.r * l.r * 520, r1 = r0 + 30 + l.r * 90 * vf, cs = Math.cos(l.a), sn = Math.sin(l.a);
          ctx.globalAlpha = Math.min(1, l.r * 2) * (1 - l.r * .5) * .8; ctx.lineWidth = 1 + l.r * 3;
          ctx.beginPath(); ctx.moveTo(W / 2 + cs * r0 * 1.3, H / 2 + sn * r0); ctx.lineTo(W / 2 + cs * r1 * 1.3, H / 2 + sn * r1); ctx.stroke();
        }
        ctx.restore(); ctx.globalAlpha = 1;
        vignette(.45);
      }
    };
    return g;
  }, 'Fly');

  /* ───────────────────────── 2. MOLE ───────────────────────── */
  reg3('td_mole', sp => {
    const S = T3.scene({ bg: 0x9ad8ff, ground: 0x7ed957, cam: [0, 10, 8.6], look: [0, 0, .6], fov: 48, sun: [4, 12, 6] });
    const need = 5 + (sp > 1.4 ? 1 : 0) + (sp > 1.8 ? 1 : 0);
    const M = T3.mk, holes = [];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 3.3, z = (j - 1) * 2.8;
      T3.cyl(S, 1.0, 1.0, .06, 0x2b1a12, [x, .04, z], null, 1.0);
      const m = torusMesh(1.12, .3, 0x8a5a2e); m.position.set(x, .08, z); m.scale.z = .6; m.receiveShadow = true; S.scene.add(m);
      holes.push({ x, z, c: null });
    }
    /* scenery */
    for (let i = 0; i < 16; i++) {
      const x = rnd(-9, 9), z = rnd(-6, 6); if (holes.some(h => Math.hypot(h.x - x, h.z - z) < 1.8)) continue;
      T3.sphere(S, .13, i % 2 ? 0xff7fb0 : 0xffe14d, [x, .13, z], 1.15);
    }
    for (const x of [-9, -5.5, 6, 9.5]) { T3.cyl(S, .35, .45, 2, 0x8a5a2e, [x, 1, -8]); T3.sphere(S, 1.7, 0x4fbf4f, [x, 3.3, -8]); }
    const mkMole = () => {
      const g = new THREE.Group();
      const b = M.sphere(.78, 0x9a6b43); b.scale.set(1, 1.15, 1); b.position.y = .55; g.add(b);
      const n = M.sphere(.17, 0xff8fb1, 1.12); n.position.set(0, .55, .76); g.add(n);
      for (const s of [-1, 1]) {
        const e = M.sphere(.17, 0xffffff, 1.1); e.position.set(s * .3, .9, .62); g.add(e);
        const p = M.sphere(.08, 0x14101c, 1); p.position.set(s * .3, .9, .78); g.add(p);
        const c = M.box(.3, .22, .3, 0xffe9c4); c.position.set(s * .6, .22, .58); g.add(c);
      }
      return g;
    };
    const mkBug = () => {
      const g = new THREE.Group();
      const b = M.sphere(.72, 0xe8433a); b.scale.set(1, .85, 1.15); b.position.y = .52; g.add(b);
      const h = M.sphere(.4, 0x14101c); h.position.set(0, .55, .78); g.add(h);
      for (const [x, z] of [[-.35, -.15], [.35, -.15], [0, -.5], [0, .2]]) { const d = M.sphere(.13, 0x14101c, 1); d.position.set(x, .98 - Math.abs(z) * .1, z); g.add(d); }
      for (const s of [-1, 1]) {
        const e = M.sphere(.12, 0xffffff, 1.1); e.position.set(s * .2, .7, 1.08); g.add(e);
        const a = M.cyl(.04, .04, .6, 0x14101c, 1); a.position.set(s * .25, 1.0, .9); a.rotation.z = -s * .5; g.add(a);
      }
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

    let count = 0, spawnT = .35, T = 0, sw = 0, mx = 0, mz = 1, gp = null, cam = 0;
    const life = clamp(1.1 - .22 * (sp - 1), .65, 1.1), maxAct = sp > 1.5 ? 3 : 2;
    const active = () => pool.filter(c => c.state === 'rise' || c.state === 'hold');
    const wp = new THREE.Vector3();

    function whack(c) {
      c.state = 'hit'; c.t = 0; count++;
      wp.set(c.hole.x, 1, c.hole.z); const s = T3.screen(S, wp);
      if (c.kind === 'bug') sfx.splat(); else sfx.boing();
      sfx.hit(); sfx.thud(); sfx.blip(count * 2); shake(7, .18); cam = 1;
      burst(s.x, s.y, c.kind === 'bug' ? '#e8433a' : '#c98a3d', 14); burst(s.x, s.y, '#FFE14D', 8, 200); ring(s.x, s.y, '#fff', 80);
      floatText(['BONK!', 'WHACK!', 'POW!', 'SMASH!'][Math.floor(Math.random() * 4)], s.x, s.y - 40, '#FFE14D', 34);
      if (count >= need && !g.result) { g.result = 'win'; sfx.sparkle(); confetti(W / 2, H / 2, 50); }
    }
    const g = {
      cmd: 'WHACK!', hint: 'CLICK THE MOLES AND BUGS', thint: 'TAP THE MOLES', dur: 7,
      move(p) { const q = T3.ground(S, p, .3); if (q) { gp = q; } },
      down(p) {
        if (g.result) return; g.move(p); sw = .28; sfx.whoosh(false);
        let hit = null;
        const act = active(), r = act.length ? T3.ray(S, p, act.map(c => c.g)) : null;
        if (r) { let o = r.object; while (o && !o.userData.crit) o = o.parent; if (o) hit = o.userData.crit; }
        if (!hit && gp) { let bd = 1.35; for (const c of act) { const d = Math.hypot(gp.x - c.hole.x, gp.z - c.hole.z); if (d < bd && c.h > .3) { bd = d; hit = c; } } }
        if (hit) whack(hit);
        else { sfx.miss(); ring(p.x, p.y, 'rgba(255,255,255,.8)', 50, .3); }
      },
      update(dt) {
        dt = Math.min(dt, .05); T += dt; cam *= Math.pow(.02, dt);
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
        for (const c of pool) {
          if (c.state === 'off') continue;
          c.t += dt; let sy = 1, sx = 1, h = 0;
          if (c.state === 'rise') { const u = Math.min(1, c.t / .16); h = eoBack(u); sy = 1 + .25 * Math.sin(u * Math.PI); sx = 1 / Math.sqrt(sy); if (c.t >= .16) { c.state = 'hold'; c.t = 0; } }
          else if (c.state === 'hold') { h = 1; sy = 1 + .04 * Math.sin(T * 16); sx = 1 / Math.sqrt(sy); if (c.t > c.life) { c.state = 'sink'; c.t = 0; } }
          else if (c.state === 'sink') { h = Math.max(0, 1 - c.t / .22); sy = .9; sx = 1.05; if (c.t >= .22) { c.state = 'off'; c.hole.c = null; c.hole = null; c.g.visible = false; continue; } }
          else { /* hit: flattened, then drops */
            h = c.t < .1 ? 1 - c.t * .8 : Math.max(0, .92 - (c.t - .1) / .2 * .92); sy = .38; sx = 1.5;
            if (c.t >= .3) { c.state = 'off'; c.hole.c = null; c.hole = null; c.g.visible = false; continue; }
          }
          c.h = h; c.g.visible = h > .03; c.g.position.y = -1.9 + 2.0 * h; c.g.scale.set(sx, sy, sx);
          c.g.rotation.y = c.state === 'hold' ? Math.sin(T * 6 + c.hole.x) * .12 : 0;
        }
        /* mallet follows pointer; swing animation */
        if (gp) { mx += (gp.x - mx) * Math.min(1, 25 * dt); mz += (gp.z + .6 - mz) * Math.min(1, 25 * dt); }
        let lift = 2.1, tilt = .5;
        if (sw > 0) { sw -= dt; const p = 1 - sw / .28, d = p < .35 ? p / .35 : 1 - (p - .35) / .65; lift = 2.1 - 1.55 * d; tilt = .5 - .85 * d; }
        mal.position.set(mx, lift, mz); mal.rotation.set(tilt, 0, 0);
        const c = S.camera; c.position.set((Math.random() - .5) * cam * .25, 10 + (Math.random() - .5) * cam * .25, 8.6); c.lookAt(0, 0, .6);
      },
      draw() { T3.render(S); pips(count, need); }
    };
    return g;
  }, 'Whack');

  /* ───────────────────────── 3. ROLL ───────────────────────── */
  reg3('td_roll', sp => {
    const S = T3.scene({ bg: 0xffd88a, cam: [0, 11.5, 9.5], look: [0, -.4, .5], fov: 48, sun: [5, 14, 7], ground: 0xf4e6ff });
    S.floor.position.y = -3.4;
    const M = T3.mk, piv = new THREE.Group();
    const base = M.box(10.4, .5, 10.4, 0x3a8fd0); piv.add(base);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
      const t = M.box(1.96, .08, 1.96, (i + j) % 2 ? 0x6ed0ff : 0x9be8ff, 1.0); t.position.set((i - 2) * 2, .27, (j - 2) * 2); piv.add(t);
    }
    const rb = M.box(10.4, .6, .3, 0xffa62b); rb.position.set(0, .5, -5.05); piv.add(rb);
    const rl = M.box(.3, .6, 10.4, 0xffa62b); rl.position.set(-5.05, .5, 0); piv.add(rl);
    /* layout: start, goal, holes */
    const start = { x: -3.6, z: 3.6 }, goal = { x: rnd(2.6, 3.8), z: rnd(-3.8, -2.6) };
    const holes = [], nh = 3 + Math.round((sp - 1) * 3), HR = .8;
    for (let tries = 0; holes.length < nh && tries < 200; tries++) {
      const h = { x: rnd(-4, 4), z: rnd(-4, 4) };
      if (Math.hypot(h.x - start.x, h.z - start.z) < 2.4 || Math.hypot(h.x - goal.x, h.z - goal.z) < 2.2) continue;
      if (holes.some(o => Math.hypot(o.x - h.x, o.z - h.z) < 2.3)) continue;
      holes.push(h);
    }
    for (const h of holes) {
      const d = M.cyl(HR, HR, .1, 0x14101c, 1.0); d.position.set(h.x, .33, h.z); piv.add(d);
      const r = torusMesh(HR, .1, 0xffe14d); r.position.set(h.x, .36, h.z); piv.add(r);
    }
    const gDisc = new THREE.Mesh(new THREE.CylinderGeometry(.85, .85, .04, 24), new THREE.MeshBasicMaterial({ color: 0xdfffc8 })); gDisc.position.set(goal.x, .32, goal.z); piv.add(gDisc);
    const gRing = torusMesh(.9, .12, 0x7cff6b, true); gRing.position.set(goal.x, .45, goal.z); piv.add(gRing);
    const pole = M.cyl(.06, .06, 1.8, 0xffffff, 1.1); pole.position.set(goal.x, 1.2, goal.z - .3); piv.add(pole);
    const flag = M.box(.8, .45, .05, 0xe8433a, 1.1); flag.position.set(goal.x + .4, 1.9, goal.z - .3); piv.add(flag);
    /* ball */
    const ball = M.sphere(.5, 0xe8433a); ball.position.set(start.x, .81, start.z);
    for (const [x, y, z] of [[.5, 0, 0], [-.5, 0, 0], [0, .5, 0], [0, -.5, 0], [0, 0, .5], [0, 0, -.5]]) { const d = M.sphere(.13, 0xffffff, 1); d.position.set(x, y, z); ball.add(d); }
    piv.add(ball);
    T3.add(S, piv, [0, 0, 0]);
    /* pedestal */
    T3.cyl(S, 1.6, 2.4, 2.6, 0x8a5fd0, [0, -1.7, 0]);

    let bx = start.x, bz = start.z, vx = 0, vz = 0, by = .81, vy = 0, state = 'play', fallT = 0, T = 0;
    let nx = 0, nz = 0, rx = 0, rz = 0, cam = 0, hole = null, usingKeys = false;
    const MAXT = .34;
    const wp = new THREE.Vector3();
    const evt = (txtS, col, sz, y = 0.8) => {
      wp.set(bx, y, bz); piv.localToWorld(wp); const s = T3.screen(S, wp); return s;
    };

    const g = {
      cmd: 'ROLL!', hint: 'TILT TO THE GOAL', thint: 'DRAG TO TILT', dur: 8,
      move(p) { if (usingKeys) return; nx = clamp((p.x - W / 2) / (W / 2), -1, 1); nz = clamp((p.y - H / 2) / (H / 2), -1, 1); },
      down(p) { g.move(p); },
      update(dt) {
        dt = Math.min(dt, .033); T += dt; cam *= Math.pow(.02, dt);
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
          }
          if (state === 'play' && (bx > 5.25 || bz > 5.25)) {
            state = 'fall'; g.result = 'lose'; vy = 0; sfx.miss(); sfx.whoosh(false); shake(8, .3); cam = 1;
            const s = evt(); floatText('OOPS!', s.x, s.y - 60, '#ff5a8a', 40);
          }
          if (state === 'play' && Math.hypot(bx - goal.x, bz - goal.z) < .62) {
            state = 'goal'; g.result = 'win'; sfx.sparkle(); sfx.coin(); shake(5, .2); cam = .6;
            const s = evt(); burst(s.x, s.y, '#7cff6b', 20, 320); burst(s.x, s.y, '#FFE14D', 12, 260); ring(s.x, s.y, '#fff', 120, .5); floatText('GOAL!', s.x, s.y - 60, '#7cff6b', 48); confetti(s.x, s.y, 50);
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
        const c = S.camera; c.position.set(rz * -3 + (Math.random() - .5) * cam * .3, 11.5 + (Math.random() - .5) * cam * .3, 9.5 - (state === 'fall' ? Math.min(2, fallT) : 0)); c.lookAt(0, -.4, .5);
        if (state === 'fall') fallT += dt;
      },
      draw() { T3.render(S); }
    };
    return g;
  }, 'Roll');

  /* ───────────────────────── 4. BASKET ───────────────────────── */
  reg3('td_basket', sp => {
    const S = T3.scene({ bg: 0x9ad8ff, ground: 0x7ed957, cam: [0, 6, 10.5], look: [0, 2, 0], fov: 62, sun: [4, 14, 6], fog: [28, 60] });
    const M = T3.mk, need = 5, XR = 4.4;
    /* scenery */
    for (const x of [-9, -4.5, 2, 7, 11]) { T3.sphere(S, rnd(1, 1.5), 0x4fbf4f, [x + rnd(-1, 1), 1, -8], 1.06); }
    for (const x of [-11, 9.5]) { T3.cyl(S, .4, .5, 3, 0x8a5a2e, [x, 1.5, -6]); T3.sphere(S, 2.2, 0x3fae5a, [x, 4.2, -6]); }
    /* basket + Claude */
    const bk = new THREE.Group();
    const body = M.cyl(1.05, .82, .8, 0xc98a3d); body.position.y = .4; bk.add(body);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(.95, .95, .02, 20), T3.mat(0x4a2e14)); inner.position.y = .8; bk.add(inner);
    const rim = torusMesh(1.0, .09, 0x8a5a2e); rim.position.y = .82; bk.add(rim);
    for (const [r, y] of [[.9, .22], [.98, .56]]) { const w = torusMesh(r, .05, 0x9b6a30); w.position.y = y; bk.add(w); }
    const cl = T3.claude(null, .5, OR); cl.position.set(0, 0, -1.6); cl.armL.position.set(-1.9, 1.5, 1.2); cl.armR.position.set(1.9, 1.5, 1.2); bk.add(cl);
    T3.add(S, bk, [0, 0, 1]);
    /* shared shadow-disc resources */
    const DG = new THREE.CylinderGeometry(.5, .5, .02, 16);
    const DM = new THREE.MeshBasicMaterial({ color: 0x14101c, transparent: true, opacity: .3 }), DB = new THREE.MeshBasicMaterial({ color: 0x8a0f0f, transparent: true, opacity: .45 });
    const fruitCols = [0x7ed957, 0xffa62b, 0xffe14d, 0xc77dff];
    const mkFruit = k => {
      const g = new THREE.Group(), b = M.sphere(.42, fruitCols[k]);
      if (k === 2) b.scale.set(1.25, .9, 1); else if (k === 3) b.scale.set(1, 1.1, 1);
      g.add(b);
      const st = M.cyl(.04, .04, .25, 0x6b3f1d, 1.1); st.position.y = .45; g.add(st);
      const lf = M.box(.22, .04, .12, 0x2f9a3a, 1.1); lf.position.set(.14, .52, 0); lf.rotation.z = .4; g.add(lf);
      return g;
    };
    const mkBug = () => {
      const g = new THREE.Group(), b = M.sphere(.46, 0xe8433a); b.scale.set(1, .85, 1.15); g.add(b);
      const h = M.sphere(.26, 0x14101c); h.position.set(0, 0, .5); g.add(h);
      for (const [x, y, z] of [[-.24, .3, -.1], [.24, .3, -.1], [0, .34, -.35]]) { const d = M.sphere(.1, 0x14101c, 1); d.position.set(x, y, z); g.add(d); }
      for (const s of [-1, 1]) {
        const e = M.sphere(.08, 0xffffff, 1.1); e.position.set(s * .13, .08, .7); g.add(e);
        const l = M.box(.5, .05, .05, 0x14101c, 1); l.position.set(s * .5, -.12, 0); l.rotation.z = s * -.4; g.add(l);
      }
      return g;
    };

    const items = [];
    let bx = 0, bz = 1, tx = 0, tz = 1, caught = 0, T = 0, spawnT = .3, nSpawn = 0, sq = 0, cam = 0, vxs = 0, over = false;
    const vBase = 5 + 2 * sp, wp = new THREE.Vector3();
    const kill = it => { S.scene.remove(it.g); S.scene.remove(it.sh); dispose(it.g); };
    const scr = (x, y, z) => { wp.set(x, y, z); return T3.screen(S, wp); };

    const g = {
      cmd: 'CATCH!', hint: 'CATCH FRUIT, DODGE BUGS', thint: 'DRAG TO MOVE', dur: 8,
      move(p) { const q = T3.ground(S, p, .9); if (q) { tx = clamp(q.x, -XR, XR); tz = clamp(q.z, -1.4, 3.2); } },
      down(p) { g.move(p); },
      update(dt) {
        dt = Math.min(dt, .04); T += dt; sq *= Math.pow(.005, dt); cam *= Math.pow(.02, dt);
        const kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0), kz = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
        if (kx || kz) { tx = clamp(tx + kx * 10 * dt, -XR, XR); tz = clamp(tz + kz * 6 * dt, -1.4, 3.2); }
        const ox = bx; bx += (tx - bx) * Math.min(1, 14 * dt); bz += (tz - bz) * Math.min(1, 14 * dt); vxs += ((bx - ox) / dt - vxs) * Math.min(1, 10 * dt);
        bk.position.set(bx, 0, bz); bk.rotation.z = clamp(-vxs * .02, -.2, .2);
        bk.scale.set(1 + sq * .25, 1 - sq * .2, 1 + sq * .25);
        cl.position.y = Math.abs(Math.sin(T * 14)) * Math.min(1, Math.abs(vxs) * .2) * .12;
        for (let i = 0; i < 4; i++) cl.legs[i].rotation.x = Math.sin(T * 16 + i) * Math.min(.5, Math.abs(vxs) * .1);
        if (over) { cl.rotation.z = Math.sin(T * 40) * .08; }
        if (!g.result) {
          spawnT -= dt;
          if (spawnT <= 0) {
            const bug = nSpawn >= 2 && Math.random() < .32; nSpawn++;
            const fg = bug ? mkBug() : mkFruit(Math.floor(Math.random() * 4)), x = rnd(-XR + .2, XR - .2), z = rnd(-1, 2.8), y = 9.5;
            T3.add(S, fg, [x, y, z]);
            const sh = new THREE.Mesh(DG, bug ? DB : DM); sh.position.set(x, .03, z); S.scene.add(sh);
            items.push({ g: fg, sh, bug, x, y, z, vy: vBase * rnd(.9, 1.15), spin: rnd(-4, 4) });
            spawnT = (.55 + Math.random() * .3) / Math.sqrt(sp);
          }
        }
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i], py = it.y; it.y -= it.vy * dt;
          it.g.position.y = it.y; it.g.rotation.y += it.spin * dt; it.g.rotation.z = Math.sin(T * 5 + it.x) * .2;
          const k = clamp(1 - (it.y - .6) / 9, 0, 1); it.sh.scale.set(.4 + .8 * k, 1, .4 + .8 * k);
          if (!g.result && py > .95 && it.y <= .95 && Math.hypot(it.x - bx, it.z - bz) < 1.1) {
            const s = scr(it.x, 1.2, it.z);
            if (it.bug) {
              over = true; g.result = 'lose'; sfx.buzz(); sfx.thud(); shake(12, .35); cam = 1; sq = 1;
              burst(s.x, s.y, '#e8433a', 16, 300); ring(s.x, s.y, '#ff5a8a', 110, .45); floatText('BUG!', s.x, s.y - 50, '#ff5a8a', 46);
            } else {
              caught++; sq = 1; sfx.coin(); sfx.blip(caught * 2); sfx.pop();
              burst(s.x, s.y, '#FFE14D', 12, 240); ring(s.x, s.y, '#fff', 70, .35); floatText('+1', s.x, s.y - 40, '#FFE14D', 36);
              if (caught >= need) { g.result = 'win'; sfx.sparkle(); confetti(W / 2, H / 2, 50); cam = .5; }
            }
            kill(it); items.splice(i, 1); continue;
          }
          if (it.y <= .4) {
            if (!it.bug) { const s = scr(it.x, .3, it.z); burst(s.x, s.y, '#fff', 5, 120); sfx.tick(); } else sfx.tick();
            kill(it); items.splice(i, 1);
          }
        }
        const c = S.camera; c.position.set(bx * .12 + (Math.random() - .5) * cam * .3, 6 + (Math.random() - .5) * cam * .3, 10.5); c.lookAt(bx * .06, 2, 0);
      },
      draw() { T3.render(S); pips(caught, need); }
    };
    return g;
  }, 'Catch');
})();
