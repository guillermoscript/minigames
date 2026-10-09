'use strict';
/* LIGHT HERO (after Mega Microgame$' "Alien Laser Hero"): grumpy meteors fall on a night city. A giant light bulb on a
   lighthouse fires a continuous beam at the pointer (touch aims a bit above the finger; arrow keys accelerate and the
   tip snaps onto nearby rocks once released). Keep the bright tip (or, slower, the beam) on a rock to fry it;
   after 6 rocks a UFO flies in dropping more: hold the beam on it to blow it up. 3 rocks on the city = lights out. */
(function () {
  /* ───── DUO-look art kit (docs/ART-STYLE.md): local copy, draws on X (ctx, or an offscreen layer while baking). Art only: never touches game RNG, decor uses hr(). ───── */
  const TAU = Math.PI * 2;
  let X = null;
  const hr = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const cl = k => Math.max(0, Math.min(1, k));
  const ease = k => (k = cl(k), k * k * (3 - 2 * k));
  const outBack = k => { k = cl(k) - 1; const c = 1.70158; return 1 + (c + 1) * k * k * k + c * k * k; };
  const hx = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, k) => { const p = hx(a), q = hx(b); return `rgb(${p[0] + (q[0] - p[0]) * k | 0},${p[1] + (q[1] - p[1]) * k | 0},${p[2] + (q[2] - p[2]) * k | 0})`; };
  function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
  function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); }
  function ink(fill, o = 4, oc = INK) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = oc; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
  function cel(P, base, shade, sx, sy, o = 4) {   // inked shape: shade first, base shifted over it = a crescent of shade
    P(); ink(shade, o); X.save(); P(); X.clip(); X.translate(-sx, -sy); P(); X.fillStyle = base; X.fill(); X.restore();
  }
  function glint(x, y, rx, ry, rot = -.5, a = .5) { X.fillStyle = `rgba(255,255,255,${a})`; el(x, y, rx, ry, rot); X.fill(); }
  function bake(fn) {
    const c = document.createElement('canvas'); c.width = VW; c.height = H; const old = X; X = c.getContext('2d'); X.translate(OX, 0);
    try { fn(); } finally { X = old; } return c;
  }
  function eye(x, y, r, look, mood, T, k) {   // crane-style eye: sclera, pupil toward look, white dot, blink
    if (mood === 'happy') { X.beginPath(); X.arc(x, y + r * .3, r * .7, Math.PI * 1.1, Math.PI * 1.9); X.lineWidth = r * .45; X.strokeStyle = INK; X.lineCap = 'round'; X.stroke(); return; }
    if (mood === 'dead') { X.lineWidth = r * .42; X.strokeStyle = INK; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - r * .6, y - r * .6); X.lineTo(x + r * .6, y + r * .6); X.moveTo(x + r * .6, y - r * .6); X.lineTo(x - r * .6, y + r * .6); X.stroke(); return; }
    const pan = mood === 'panic', R = pan ? r * 1.3 : r;
    if (!pan && Math.sin(T * 1.9 + k) > .985) { X.lineWidth = r * .4; X.strokeStyle = INK; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - R, y); X.lineTo(x + R, y); X.stroke(); return; }
    el(x, y, R, R * 1.08); ink('#fff', Math.max(1.5, r * .28));
    const pr = pan ? r * .32 : r * .52, px = x + look[0] * R * .38, py = y + look[1] * R * .38;
    X.beginPath(); X.arc(px, py, pr, 0, TAU); X.fillStyle = INK; X.fill();
    X.beginPath(); X.arc(px - pr * .35, py - pr * .4, Math.max(1, pr * .38), 0, TAU); X.fillStyle = '#fff'; X.fill();
  }
  function heart(x, y, s) {
    X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
    ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
  }
  function drop(x, y, s, a = 1) {
    X.save(); X.globalAlpha = a; X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, -9); X.quadraticCurveTo(7, 1, 0, 6); X.quadraticCurveTo(-7, 1, 0, -9); X.closePath();
    ink('#9fe3ff', 2.5); X.fillStyle = '#fff'; el(-1.8, 0, 1.6, 2.4); X.fill(); X.restore();
  }
  function marquee(x, y, w, h, T, col) {   // night sign with a chasing bulb rim
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(x + 4, y + 7, w, h, 16); X.fill();
    rr(x, y, w, h, 16); ink('#2a1f5c', 4);
    X.fillStyle = 'rgba(255,255,255,.12)'; rr(x + 8, y + 5, w - 16, h * .28, 9); X.fill();
    const n = Math.max(4, Math.floor(w / 24));
    for (let i = 0; i < n; i++) for (const yy of [y + 6, y + h - 6]) { const on = (Math.floor(T * 5) + i) % 2; X.beginPath(); X.arc(x + 14 + i * (w - 28) / (n - 1), yy, 3, 0, TAU); X.fillStyle = on ? (col || '#FFE14D') : '#8b7fc9'; X.fill(); }
  }
  function lampBulb(x, y, on, crack) {
    X.beginPath(); X.arc(x, y, 10, 0, TAU); ink(on ? '#FFE14D' : '#4a4468', 3);
    if (on) glint(x - 3, y - 4, 3.2, 2, -.6, .7);
    rr(x - 5, y + 9, 10, 7, 2); ink('#9aa0b4', 2);
    if (crack) { X.strokeStyle = INK; X.lineWidth = 2; X.lineCap = 'round'; X.beginPath(); X.moveTo(x - 4, y - 7); X.lineTo(x + 1, y - 1); X.lineTo(x - 2, y + 3); X.lineTo(x + 4, y + 8); X.stroke(); }
  }
  BOSSES.laser = function (sp, s) {
    const k = Math.min(sp, 1.3) / 1.3, NEED = 6, LIVES = 3, TIP = 36, ROCK_T = .25, UFO_T = .5, BODY = .4, FINGER = 64, LOCK_R = 150, LOCK_BREAK = .35;
    const rocks = [], sparks = [], dents = [], stars = [], far = [], city = [];
    const aim = { x: 520, y: 330 };
    let phase = 'rocks', burned = 0, hits = 0, clock = 0, spawnT = .35, ufo = null, nid = 0, bq = 0, hurt = 0, hum = 0, contact = false, kb = false, hold = 0, lock = null, lockT = 0, lockH = 0, free = 0, boom = null, tipR = TIP;
    const BX = () => 85 - OX, BY = 318, BR = 50;
    for (let i = 0; i < 90; i++) stars.push({ x: -700 + Math.random() * 2200, y: 150 + Math.random() * 300, s: 1 + Math.random() * 2, ph: Math.random() * 6 });
    for (let x = -720; x < 1520; x += 40 + Math.random() * 50) far.push({ x, w: 46 + Math.random() * 50, h: 70 + Math.random() * 90 });
    for (let x = -720; x < 1520;) { const w = 58 + Math.random() * 54; city.push({ x, w, top: 472 + Math.random() * 40, col: ['#3b2f6b', '#46377a', '#2f2a5e', '#523f84'][city.length % 4], win: Math.random() * 1e6 | 0 }); x += w + 6; }
    const roofAt = x => { for (const b of city) if (x >= b.x && x < b.x + b.w) return b.top; return 520; };
    const spawn = (x, y, vy) => rocks.push({ id: ++nid, x, y, vx: (Math.random() - .5) * 40, vy, r: 24 + Math.random() * 8, heat: 0, rot: 0, pop: 0, pts: [...Array(9)].map(() => .82 + Math.random() * .3) });
    const near = (o, r) => Math.hypot(aim.x - o.x, aim.y - o.y) < r + tipR;
    const tipSparks = (x, y, n, col) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 120 + Math.random() * 320; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: .25 + Math.random() * .25, c: col || (Math.random() < .5 ? '#fff' : '#FFE14D') }); } };
    const fry = (o, i) => {
      rocks.splice(i, 1); burned++; bq = .25; sfx.pop(); sfx.hit(); sfx.blip(burned * 2); shake(4, .12);
      if (lock === o && !hold) {   // keyboard chain: hop to the nearest rock left on screen
        lock = null; let bd = 330; for (const r of rocks) { const d = Math.hypot(r.x - o.x, r.y - o.y); if (d < bd) { bd = d; lock = r; } } if (lock) lockT = lockH = 0;
      }
      burst(o.x, o.y, '#FF8A3D', 14, 320); burst(o.x, o.y, '#FFE14D', 8, 200); ring(o.x, o.y, '#FFE14D', 70, .35); tipSparks(o.x, o.y, 14);
      floatText(['FRIED!', 'TOASTY!', 'SIZZLED!'][burned % 3], o.x, Math.max(200, o.y - 40), '#FFE14D', 32);
      if (phase === 'rocks' && burned >= NEED) {   // power surge: leftover rocks fizzle, the UFO flies in
        for (const r of rocks) { burst(r.x, r.y, '#FF8A3D', 8, 220); ring(r.x, r.y, '#FFE14D', 50, .3); } rocks.length = 0;
        phase = 'ufo'; ufo = { x: W + OX + 140, y: 205, heat: 0, t: 0, drop: 1.2, hit: 0 }; floatText('UFO!', W / 2, 210, '#5CFF7A', 60); sfx.whoosh(false); snd(500, .5, 'sine', .05, 0, 900); snd(900, .5, 'sine', .04, .2, 400); }
    };
    const crash = (o, i) => {
      rocks.splice(i, 1); hits++; hurt = .5; dents.push({ x: o.x, y: roofAt(o.x), t: 0 }); sfx.thud(); sfx.splat(); shake(10, .3);
      burst(o.x, o.y, '#8a7a6a', 16, 300); ring(o.x, o.y, '#FF4D4D', 90, .4);
      if (hits >= LIVES) { g.result = 'lose'; sfx.buzz(); floatText('LIGHTS OUT!', W / 2, 205, '#FF4D6D', 60); }
      else floatText('MY CITY!', o.x, o.y - 50, '#FF4D6D', 36);
    };
    let lay = null, wT = -1;   // art only: baked layers + the verdict clock
    const buildLay = () => {
      const farL = () => { for (let i = 0; i < far.length; i++) { const b = far[i]; rr(b.x, 548 - b.h, b.w, b.h + 20, 4); ink(i % 2 ? '#2f2468' : '#2a2060', 2.5, '#4a3a8a'); if (hr(i + 5) > .55) { X.strokeStyle = '#4a3a8a'; X.lineWidth = 2.5; X.beginPath(); X.moveTo(b.x + b.w * .7, 548 - b.h); X.lineTo(b.x + b.w * .7, 548 - b.h - 14); X.stroke(); } for (let wy = 548 - b.h + 12; wy < 540; wy += 20) for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 14) if (hr(i * 31 + wx + wy) > .72) { X.fillStyle = '#c9a94a'; X.fillRect(wx, wy, 4, 5); } } };
      const bldg = (b, i, lit) => {
        const h = 600 - b.top, P = () => rr(b.x, b.top, b.w, h, 6);
        cel(P, b.col, mix(b.col, '#14102a', .4), 9, 0, 4);
        X.fillStyle = 'rgba(255,255,255,.1)'; rr(b.x + 4, b.top + 6, 4, h - 40, 2); X.fill();
        const k = hr(b.win % 97 + i);   // roof prop
        if (k > .72) { X.strokeStyle = INK; X.lineWidth = 8; X.lineCap = 'round'; X.beginPath(); X.moveTo(b.x + b.w * .3, b.top - 6); X.lineTo(b.x + b.w * .3, b.top - 30); X.stroke(); X.strokeStyle = '#9aa0b4'; X.lineWidth = 3; X.stroke(); X.beginPath(); X.arc(b.x + b.w * .3, b.top - 32, 3, 0, TAU); ink('#FF4D6D', 2); }
        else if (k > .45) { rr(b.x + b.w * .55, b.top - 24, 22, 18, 3); ink('#8a6a9a', 3); }
        rr(b.x - 3, b.top - 8, b.w + 6, 13, 4); ink(mix(b.col, '#ffffff', .2), 3.5);
        let r = b.win;
        for (let y = b.top + 12; y < 548; y += 22) for (let x = b.x + 9; x < b.x + b.w - 14; x += 18) {
          r = r * 1103515245 + 12345 & 0x7fffffff; const on = lit && r % 5 > 1; rr(x, y, 10, 12, 2.5); ink(on ? '#FFE14D' : '#1d1838', 1.5);
          if (on) { glint(x + 3, y + 3, 2.2, 1.6, -.5, .7); if (r % 7 === 0) { X.fillStyle = '#FF8A3D'; X.fillRect(x + 1, y + 1, 2.5, 10); } }
          else if (!lit && r % 4 === 0) { for (const d of [-1, 1]) { X.beginPath(); X.arc(x + 5 + d * 2.3, y + 6, 1.8, 0, TAU); X.fillStyle = '#fff'; X.fill(); } }
        }
      };
      const city2 = lit => () => {
        farL();
        for (let i = 0; i < city.length; i++) { const b = city[i]; if (b.x > W + OX + 20 || b.x + b.w < -OX - 20) continue; bldg(b, i, lit); }
        X.fillStyle = '#2b2252'; X.fillRect(-OX, 548, VW, 52); X.fillStyle = 'rgba(255,255,255,.1)'; X.fillRect(-OX, 556, VW, 3);
        X.fillStyle = INK; X.fillRect(-OX, 546, VW, 4);
        for (let x = -OX - ((-OX) % 60) - 60; x < W + OX; x += 60) { X.fillStyle = '#6b6490'; X.fillRect(x, 580, 28, 4); }
      };
      return {
        vw: VW, ox: OX,
        sky: bake(() => { const sky = X.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#13102f'); sky.addColorStop(.5, '#2c2070'); sky.addColorStop(.85, '#6a3a8a'); sky.addColorStop(1, '#a8508a'); X.fillStyle = sky; X.fillRect(-OX, 0, VW, H); }),
        lit: bake(city2(true)), dark: bake(city2(false)),
      };
    };
    const g = {
      cmd: 'BOSS!', hint: 'ZAP ROCKS: MOUSE OR ARROWS!', thint: 'DRAG THE LIGHT TO ROCKS!', dur: 12, boss: true, wide: true,
      move(p) { aim.x = p.x; aim.y = p.y - (p.touch ? FINGER : 0); tipR = p.touch ? TIP + 16 : TIP; kb = false; lock = null; },   // touch: a wider tip that floats above the finger
      down(p) { g.move(p); },
      update(dt) {
        clock += dt; bq = Math.max(0, bq - dt); hurt = Math.max(0, hurt - dt);
        for (let i = sparks.length - 1; i >= 0; i--) { const p = sparks[i]; p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) sparks.splice(i, 1); }
        for (const d of dents) d.t += dt;
        if (ufo) ufo.hit = Math.max(0, ufo.hit - dt);
        if (g.result) { if (wT < 0) wT = now; if (ufo && g.result === 'win') ufo.y += 400 * dt; return; }
        // aim: the pointer sets it. Keys accelerate; let go near a rock (or sweep the tip over one) and the light LOCKS ON
        // and follows it until it bursts (keep holding a key ~.35 s to break free). Keyboard play also gets fewer, slower rocks.
        const kx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0), ky = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
        if (kx || ky) { kb = true; hold += dt; } else hold = free = 0;
        if (lock && ((lock !== ufo && !rocks.includes(lock)) || hold - lockH > (lock === ufo ? 2 * LOCK_BREAK : LOCK_BREAK))) { if (lock !== ufo && rocks.includes(lock)) free = 1; lock = null; }
        if (kb && !lock && !free) {
          let bd = LOCK_R; for (const o of phase === 'ufo' && ufo ? [...rocks, ufo] : rocks) { const d = Math.hypot(o.x - aim.x, o.y - aim.y); if (d < (hold ? (o === ufo ? 100 : o.r + TIP + 30) : bd)) { bd = d; lock = o; } }
          if (lock) { lockT = 0; lockH = hold; snd(1300, .06, 'square', .03); snd(1700, .06, 'square', .03, .06); }
        }
        if (lock) { lockT += dt; const d = Math.hypot(lock.x - aim.x, lock.y - aim.y), m = d > 1 ? Math.min(d, 900 * dt) / d : 0; aim.x += (lock.x - aim.x) * m; aim.y += (lock.y - aim.y) * m; }
        else if (hold) { const v = 250 + 500 * Math.min(1, hold / .35); aim.x += kx * v * dt; aim.y += ky * v * dt; }
        aim.x = Math.max(BX() + 80, Math.min(W + OX - 15, aim.x)); aim.y = Math.max(150, Math.min(540, aim.y));
        const ex = BX(), ey = BY; contact = false;
        if (phase === 'rocks') { spawnT -= dt; if (spawnT <= 0 && rocks.length < 3) { spawnT = (kb ? 1.25 : .95) - .15 * k; const x0 = Math.max(BX() + 190, 150 - OX * .5), x1 = 740 + OX * .5; spawn(x0 + Math.random() * (x1 - x0), 150, (95 + Math.random() * 40 * k) * (kb ? .85 : 1)); sfx.tick(); } }
        else if (ufo) {   // UFO: glides in, then swings side to side dropping rocks
          ufo.t += dt; const tx = 420 + Math.sin(ufo.t * .9) * (240 + OX * .4);
          ufo.x += (tx - ufo.x) * Math.min(1, dt * (ufo.t < 1.2 ? 3 : 8)); ufo.y = 205 + Math.sin(ufo.t * 2.3) * 16;
          ufo.drop -= dt; if (ufo.drop <= 0 && ufo.t > 1) { ufo.drop = (kb ? 1.8 : 1.5) - .1 * k; spawn(ufo.x, ufo.y + 30, 120 + Math.random() * 40 * k); snd(700, .2, 'sine', .04, 0, 200); }
          const tip = Math.abs(aim.x - ufo.x) < 80 && Math.abs(aim.y - ufo.y) < 55, on = tip || segD(ufo.x, ufo.y, ex, ey, aim.x, aim.y) < 34;
          if (on) { ufo.heat += dt / UFO_T * (tip ? 1 : BODY); ufo.hit = .08; contact = true; if (Math.random() < .5) tipSparks(tip ? aim.x : ufo.x, tip ? aim.y : ufo.y, 2); }
          else ufo.heat = Math.max(0, ufo.heat - dt * .2);
          if (ufo.heat >= 1) {
            g.result = 'win'; boom = { x: Math.max(160 - OX, Math.min(W + OX - 160, ufo.x)), y: 205 }; sfx.splat(); sfx.stamp(); sfx.sparkle(); shake(16, .5); confetti(ufo.x, ufo.y, 60);
            burst(ufo.x, ufo.y, '#FFE14D', 26, 420); burst(ufo.x, ufo.y, '#5CFF7A', 16, 300); ring(ufo.x, ufo.y, '#fff', 240, .6); tipSparks(ufo.x, ufo.y, 40);
            for (const o of rocks) { burst(o.x, o.y, '#FF8A3D', 10, 260); ring(o.x, o.y, '#FFE14D', 60, .3); } rocks.length = 0; return;
          }
        }
        for (let i = rocks.length - 1; i >= 0; i--) {
          const o = rocks[i]; if (!o) continue; o.pop = Math.min(1, o.pop + dt * 6); o.x += o.vx * dt; o.y += o.vy * dt; o.rot += dt * (o.vx > 0 ? 1.5 : -1.5);
          if (o.x < BX() + 160 || o.x > W + OX - 40) o.vx = -o.vx;
          const tip = near(o, o.r), on = tip || segD(o.x, o.y, ex, ey, aim.x, aim.y) < o.r + 6;
          if (on) { o.heat += dt / ROCK_T * (tip ? 1 : BODY); contact = true; if (Math.random() < .6) tipSparks(o.x, o.y - o.r * .3, 1); }
          else o.heat = Math.max(0, o.heat - dt * .6);
          if (o.heat >= 1) fry(o, i);
          else if (o.y + o.r * .6 >= roofAt(o.x)) { crash(o, i); if (g.result) return; }
        }
        hum -= dt; if (contact && hum <= 0) { hum = .09; noise(.07, .03, 2500, 5200, 'highpass'); snd(140 + Math.random() * 40, .06, 'sawtooth', .015); }
      },

      draw(t) {
        X = ctx; const lost = g.result === 'lose', won = g.result === 'win';
        if (g.result && wT < 0) wT = now;
        const oT = g.result ? Math.max(0, now - wT) : 0, mx = W + OX - 70;
        if (!lay || lay.vw !== VW || lay.ox !== OX) lay = buildLay();
        ctx.drawImage(lay.sky, -OX, 0);
        // stars twinkle, a shooting star now and then
        for (const p of stars) if (p.x > -OX && p.x < W + OX) {
          const a = .4 + .6 * Math.abs(Math.sin(t * 1.5 + p.ph)); ctx.globalAlpha = a; ctx.fillStyle = '#fff';
          if (p.s > 2.2) { ctx.fillRect(p.x - 3, p.y + p.s / 2 - .5, 7, 1.5); ctx.fillRect(p.x + p.s / 2 - .5, p.y - 3, 1.5, 7); } else ctx.fillRect(p.x, p.y, p.s, p.s);
        }
        ctx.globalAlpha = 1;
        { const u = ((t + 1.5) % 6.5) / 1.1; if (u < 1) { const sx = 520 + OX - u * 480, sy = 180 + u * 130; ctx.globalAlpha = 1 - u; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 60, sy - 26); ctx.stroke(); ctx.globalAlpha = 1; ctx.lineCap = 'butt'; } }
        // the moon: sleepy, wakes up when the city is hit
        { const my = 165, hot = hits > 0 && !won; X.save(); X.fillStyle = 'rgba(255,243,176,.12)'; X.beginPath(); X.arc(mx, my, 56 + Math.sin(t * 1.3) * 2, 0, TAU); X.fill(); X.restore();
          X.beginPath(); X.arc(mx, my, 34, 0, TAU); ink('#fff3b0', 4); X.fillStyle = '#e8d78a'; for (const [cx, cy, cr] of [[mx + 14, my + 14, 7], [mx - 20, my + 18, 5], [mx + 18, my - 18, 4]]) { el(cx, cy, cr, cr * .8); X.fill(); }
          glint(mx - 13, my - 17, 8, 4, -.6, .6);
          X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round';
          for (const d of [-1, 1]) { const ex2 = mx + d * 12, ey2 = my - 4; if (won) { X.beginPath(); X.arc(ex2, ey2 + 3, 5, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); } else if (hot || lost) eye(ex2, ey2, 5, [0, .3], lost ? 'dead' : 'panic', t, d); else { X.beginPath(); X.arc(ex2, ey2 - 2, 5, .15 * Math.PI, .85 * Math.PI); X.stroke(); } }
          X.beginPath(); if (lost) { X.arc(mx, my + 20, 6, Math.PI * 1.15, Math.PI * 1.85); } else if (won) { X.arc(mx, my + 9, 8, .1 * Math.PI, .9 * Math.PI); } else if (hot) { X.ellipse(mx, my + 14, 4, 5, 0, 0, TAU); } else { X.arc(mx, my + 12, 5, .2 * Math.PI, .8 * Math.PI); } X.stroke();
          X.fillStyle = won ? 'rgba(255,110,165,.8)' : 'rgba(255,110,165,.45)'; for (const d of [-1, 1]) { el(mx + d * 22, my + 6, 5, 3); X.fill(); }
          if (!hot && !won && !lost) { const zt = (t * .5) % 1; ctx.globalAlpha = 1 - zt; txt('z', mx - 30 - zt * 10, my - 34 - zt * 24, 18 + zt * 6, '#cfd6ff'); ctx.globalAlpha = 1; } }
        // a friendly blimp drifts by (far layer: coloured outline)
        { const bx = ((t * 16 + 420) % (VW + 360)) - OX - 180, by = 238 + Math.sin(t * .7) * 8; X.save(); X.translate(bx, by);
          X.beginPath(); X.moveTo(-44, -6); X.lineTo(-64, -22); X.lineTo(-56, 2); X.lineTo(-64, 18); X.lineTo(-44, 6); X.closePath(); ink('#d65f93', 2.5, '#7a3a7a');
          el(0, 0, 50, 22); ink('#ff8fc0', 3, '#7a3a7a'); X.save(); el(0, 0, 50, 22); X.clip(); X.fillStyle = '#d65f93'; el(6, 9, 50, 22); X.fill(); X.restore();
          glint(-16, -12, 12, 4, -.1, .5); rr(-12, 20, 24, 10, 4); ink('#8b7fc9', 2.5, '#7a3a7a');
          for (const d of [-1, 1]) { X.beginPath(); X.arc(d * 14 - 8, -3, 3.4, 0, TAU); X.fillStyle = '#fff'; X.fill(); X.beginPath(); X.arc(d * 14 - 8 + 1, -3, 1.6, 0, TAU); X.fillStyle = INK; X.fill(); }
          X.strokeStyle = INK; X.lineWidth = 2.5; X.lineCap = 'round'; X.beginPath(); if (hits > 0) X.ellipse(-8, 8, 3, 3.5, 0, 0, TAU); else X.arc(-8, 5, 7, .15 * Math.PI, .85 * Math.PI); X.stroke(); X.restore(); }
        ctx.drawImage(lay.lit, -OX, 0);
        if (lost) ctx.drawImage(lay.dark, -OX, 0);
        else for (const b of city) { if (b.x > W + OX || b.x + b.w < -OX) continue; if (dents.some(d => d.x > b.x - 40 && d.x < b.x + b.w + 40)) { const sx = Math.max(0, b.x - 5 + OX), sw = Math.min(VW - sx, b.w + 10); if (sw > 0) ctx.drawImage(lay.dark, sx, 0, sw, H, sx - OX, 0, sw, H); } }
        // street lamps along the sidewalk are baked; the roof cat watches the sky
        { const cx = 640, cb = roofAt(cx) - 8, near2 = rocks.some(o => Math.hypot(o.x - cx, o.y - cb) < 170), hop = won ? Math.abs(Math.sin(now * 9)) * 14 : 0, gone = lost ? Math.min(1, oT * 2.2) : 0;
          X.save(); X.translate(cx, cb - hop + gone * 40); X.globalAlpha = 1 - gone;
          const tw = Math.sin(t * 3) * (near2 ? .2 : .5); X.lineCap = 'round'; X.beginPath(); X.moveTo(14, -6); X.quadraticCurveTo(34 + tw * 10, -14, 28 + tw * 14, -34); X.lineWidth = near2 ? 12 : 8; X.strokeStyle = INK; X.stroke(); X.lineWidth = near2 ? 6 : 4; X.strokeStyle = '#e7a04a'; X.stroke();
          el(2, -9, 17, 12); ink('#e7a04a', 3.5); X.save(); el(2, -9, 17, 12); X.clip(); X.fillStyle = '#c47d2c'; el(6, -2, 17, 12); X.fill(); el(2, -9, 17, 12); X.restore();
          X.beginPath(); X.arc(-9, -22, 11, 0, TAU); ink('#e7a04a', 3.5); X.beginPath(); X.moveTo(-18, -28); X.lineTo(-17, -42); X.lineTo(-8, -31); X.moveTo(0, -28); X.lineTo(-1, -41); X.lineTo(-9, -31); ink('#e7a04a', 2.5);
          X.beginPath(); X.arc(-9, -22, 9.5, 0, TAU); X.fillStyle = '#e7a04a'; X.fill(); glint(-13, -26, 3, 2, -.5, .5);
          for (const d of [-1, 1]) { const ex2 = -9 + d * 4.6; if (won) { X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); X.arc(ex2, -21, 2.4, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); } else eye(ex2, -22, near2 ? 3.6 : 2.6, [-.5, -.7], near2 ? 'panic' : 'calm', t, d + 7); }
          X.strokeStyle = INK; X.lineWidth = 1.6; X.beginPath(); X.moveTo(-9, -18); X.lineTo(-9, -16.5); X.stroke(); X.restore(); X.globalAlpha = 1; }
        // craters with a little fire and smoke
        for (const d of dents) {
          const fl = Math.sin(t * 12 + d.x) * 3; ctx.beginPath(); ctx.ellipse(d.x, d.y + 4, 34, 17, 0, 0, TAU); ink('#3a2a3a', 4); X.fillStyle = '#FF8A3D'; el(d.x, d.y + 6, 19, 8); X.fill(); X.fillStyle = '#FFE14D'; el(d.x, d.y + 7, 9, 4); X.fill();
          X.beginPath(); X.moveTo(d.x - 9, d.y + 4); X.quadraticCurveTo(d.x - 4, d.y - 14 + fl, d.x, d.y - 4); X.quadraticCurveTo(d.x + 5, d.y - 18 - fl, d.x + 9, d.y + 4); X.closePath(); ink('#FF8A3D', 2.5);
          for (let j = 0; j < 3; j++) { const u = (d.t * .6 + j / 3) % 1; X.globalAlpha = .55 * (1 - u); X.beginPath(); X.arc(d.x + Math.sin(u * 6 + j) * 10, d.y - 16 - u * 90, 10 + u * 16, 0, TAU); ink('#9b93b5', 2.5, '#4b4466'); }
          X.globalAlpha = 1;
        }
        // HUD in the world: a night marquee sign (counter / UFO bar) and a rail of lamp bulbs (lives)
        if (phase === 'rocks') { marquee(W / 2 - 112, 80, 224, 50, t); txt(window.t('ROCKS {n} / {need}', { n: burned, need: NEED }), W / 2, 106, 30, '#FFE14D'); }
        else {
          const hurry = !g.result && typeof dur !== 'undefined' && dur - tt < 2.5; marquee(W / 2 - 166, 78, 332, 76, t, hurry ? '#FF4D6D' : '#5CFF7A');
          txt(hurry ? 'HURRY!' : 'ZAP THE UFO!', W / 2, 102, hurry ? 30 + Math.sin(now * 20) * 3 : 28, hurry && Math.sin(now * 20) > 0 ? '#FF4D6D' : '#5CFF7A');
          const hv = ufo ? Math.min(1, ufo.heat) : 1; rr(W / 2 - 150, 120, 300, 18, 9); ink('#14102a', 3);
          if (hv > .02) { X.save(); rr(W / 2 - 150, 120, 300, 18, 9); X.clip(); X.fillStyle = hv > .7 ? '#fff' : '#FF8A3D'; X.fillRect(W / 2 - 150, 120, 300 * hv, 18); glint(W / 2 - 150 + 300 * hv * .5, 125, 300 * hv * .35, 2.5, 0, .5); X.restore(); }
        }
        X.fillStyle = 'rgba(20,16,28,.3)'; rr(W / 2 + 186, 91, 100, 46, 14); X.fill(); rr(W / 2 + 182, 86, 100, 46, 14); ink('#2a1f5c', 4);
        for (let i = 0; i < LIVES; i++) { const x = W / 2 + 205 + i * 30, on = i >= hits; lampBulb(x, 104, on, !on); }
        // UFO (drawn under the beam)
        if (ufo && !won) {
          const x = ufo.x, y = ufo.y, h = Math.min(1, ufo.heat), jit = h * 4 + (ufo.hit ? 2 : 0);
          ctx.save(); ctx.translate(x + (Math.random() - .5) * jit, y + (Math.random() - .5) * jit); ctx.scale(1.25, 1.25);
          ctx.globalAlpha = .25 + .15 * Math.sin(t * 9); ctx.fillStyle = '#5CFF7A'; ctx.beginPath(); ctx.moveTo(-26, 18); ctx.lineTo(26, 18); ctx.lineTo(44, 120); ctx.lineTo(-44, 120); ctx.fill(); ctx.globalAlpha = 1;
          X.beginPath(); X.ellipse(0, -10, 30, 28, 0, Math.PI, 0); X.closePath(); ink('#bfe9ff', 4); glint(-13, -26, 5, 9, .5, .6);
          X.beginPath(); X.moveTo(-6, -36); X.quadraticCurveTo(-8, -52, -14, -54); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); X.beginPath(); X.arc(-14, -56, 5, 0, TAU); ink(h > .3 ? '#FF4D6D' : '#FFE14D', 2.5);
          X.beginPath(); X.ellipse(0, -8, 14, 15, 0, 0, TAU); ink('#7fd34a', 3.5); X.save(); X.beginPath(); X.ellipse(0, -8, 14, 15, 0, 0, TAU); X.clip(); X.fillStyle = '#5fb944'; el(5, -3, 14, 15); X.fill(); X.restore(); X.beginPath(); X.ellipse(0, -8, 12.5, 13.5, 0, 0, TAU); X.fillStyle = '#7fd34a'; X.fill(); glint(-5, -15, 3.5, 2, -.5, .6);
          const hot = h > .3; for (const d of [-1, 1]) eye(d * 6, -10, 4.6, [Math.max(-1, Math.min(1, (BX() - x) / 300)), .4], hot ? 'panic' : 'calm', t, d + 3);
          X.strokeStyle = INK; X.lineWidth = 2.5; X.lineCap = 'round'; X.beginPath(); if (hot) X.ellipse(0, 3, 3, 4, 0, 0, TAU); else { X.moveTo(-5, 3); X.quadraticCurveTo(0, 7, 5, 3); } X.stroke();
          const fr = h * 105, sc = ufo.hit ? .35 : 0; X.beginPath(); X.ellipse(0, 4, 74, 22, 0, 0, TAU); ink(mix('#c9ced6', '#ff5a40', Math.max(sc, h * .9)), 4);
          X.save(); X.beginPath(); X.ellipse(0, 4, 74, 22, 0, 0, TAU); X.clip(); X.fillStyle = mix('#8f9cb3', '#b4283a', h * .9); el(8, 12, 74, 22); X.fill(); X.restore(); glint(-34, -4, 22, 3.5, -.1, .6);
          for (let j = 0; j < 6; j++) { X.beginPath(); X.arc(-55 + j * 22, 6, 5, 0, TAU); ink((Math.floor(t * 8) + j) % 2 ? '#FFE14D' : '#FF4D6D', 2); }
          if (h > .55) for (let j = 0; j < 2; j++) { const u = (t * 1.4 + j * .5) % 1; X.globalAlpha = .6 * (1 - u); X.beginPath(); X.arc(-30 + j * 60 + Math.sin(u * 7) * 6, -20 - u * 40, 6 + u * 8, 0, TAU); ink('#9b93b5', 2, '#4b4466'); X.globalAlpha = 1; }
          ctx.restore();
        }
        // win: the saucer pops apart, the alien tumbles out
        if (won && boom) {
          const bx = boom.x, by = boom.y, dir = bx > W / 2 ? -1 : 1, ot = Math.min(oT, 1.6);
          for (const d of [-1, 1]) { X.save(); X.translate(bx + d * (45 + 105 * ot), by + 105 - 90 * ot + 120 * ot * ot); X.rotate(d * ot * 3.2); X.scale(1.3, 1.3); X.beginPath(); X.ellipse(0, 0, 50, 15, 0, d > 0 ? -Math.PI / 2 : Math.PI / 2, d > 0 ? Math.PI / 2 : Math.PI * 1.5); X.closePath(); ink('#c9ced6', 4); glint(-8, -4, 14, 3, 0, .5); X.restore(); }
          X.save(); X.translate(bx + dir * 105 * ot, by + 115 - 100 * ot + 130 * ot * ot); X.rotate(ot * 5); X.scale(1.5, 1.5); X.beginPath(); X.ellipse(0, 0, 17, 18, 0, 0, TAU); ink('#7fd34a', 4); for (const d of [-1, 1]) eye(d * 7, -2, 4.6, [0, 0], 'dead', t, d); X.beginPath(); X.moveTo(-6, -19); X.quadraticCurveTo(-8, -32, -14, -34); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); X.restore();
        }
        // grumpy meteors with flame trails, glowing red as they heat up
        for (const o of rocks) {
          const h = Math.min(1, o.heat), sc = outBack(o.pop), r = o.r * sc, jit = h * 3;
          const x = o.x + (Math.random() - .5) * jit, y = o.y + (Math.random() - .5) * jit;
          if (h > .05) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const hg = ctx.createRadialGradient(x, y, r * .5, x, y, r * 1.9); hg.addColorStop(0, `rgba(255,${120 + h * 100 | 0},60,${h * .75})`); hg.addColorStop(1, 'rgba(255,80,30,0)'); ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, 7); ctx.fill(); ctx.restore(); }
          X.beginPath(); X.moveTo(x - r * .8, y - r * .2); X.quadraticCurveTo(x - o.vx * .3, y - r * 3.2 - Math.sin(t * 30) * 6, x + r * .8, y - r * .2); X.closePath(); ink('#FF8A3D', 3);
          X.fillStyle = '#FFE14D'; X.beginPath(); X.moveTo(x - r * .45, y - r * .3); X.quadraticCurveTo(x - o.vx * .2, y - r * 2.1, x + r * .45, y - r * .3); X.fill();
          const P = () => { X.beginPath(); o.pts.forEach((q, j) => { const a = o.rot + j * Math.PI * 2 / 9; X.lineTo(x + Math.cos(a) * r * q, y + Math.sin(a) * r * q); }); X.closePath(); };
          const u = Math.max(0, h - .55) / .45, base = h < .55 ? `rgb(${138 + h * 212 | 0},${122 - h * 60 | 0},${106 - h * 120 | 0})` : `rgb(255,${89 + u * 150 | 0},${40 + u * 130 | 0})`;
          cel(P, base, 'rgba(60,40,70,1)', r * .3, r * .24, 4);
          X.save(); P(); X.clip(); X.fillStyle = 'rgba(20,16,28,.25)'; X.beginPath(); X.arc(x + r * .38, y + r * .4, r * .2, 0, TAU); X.arc(x - r * .5, y + r * .3, r * .12, 0, TAU); X.fill(); X.restore();
          glint(x - r * .42, y - r * .55, r * .22, r * .12, -.5, .45);
          const lk = [Math.max(-1, Math.min(1, (BX() - x) / 260)), .3], hot = h > .3, ew = hot ? r * .2 : r * .17;   // face: angry brows, then scared wide eyes + O mouth when hot
          eye(x - r * .3, y - r * .1, ew, lk, hot ? 'panic' : 'calm', t, o.id); eye(x + r * .3, y - r * .1, ew, lk, hot ? 'panic' : 'calm', t, o.id + .5);
          X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round'; X.beginPath();
          if (hot) { X.moveTo(x - r * .5, y - r * .55); X.lineTo(x - r * .15, y - r * .65); X.moveTo(x + r * .5, y - r * .55); X.lineTo(x + r * .15, y - r * .65); X.stroke(); X.beginPath(); X.ellipse(x, y + r * .42, r * .14, r * .17, 0, 0, TAU); X.fillStyle = INK; X.fill(); }
          else { X.moveTo(x - r * .55, y - r * .5); X.lineTo(x - r * .1, y - r * .32); X.moveTo(x + r * .55, y - r * .5); X.lineTo(x + r * .1, y - r * .32); X.moveTo(x - r * .25, y + r * .45); X.lineTo(x + r * .25, y + r * .38); X.stroke(); }
          if (hot) drop(x + r * .75, y - r * .5, .7);
        }
        if (lock && !g.result) {   // keyboard lock-on brackets
          const r = (lock === ufo ? 70 : lock.r + 14) + Math.max(0, .25 - lockT) * 120, q = now * 4; ctx.strokeStyle = '#5CFF7A'; ctx.lineWidth = 4; ctx.lineCap = 'round';
          for (let j = 0; j < 4; j++) { const a = q + j * Math.PI / 2; ctx.beginPath(); ctx.arc(lock.x, lock.y, r, a, a + .7); ctx.stroke(); }
          ctx.lineCap = 'butt';
        }
        // the light beam: layered additive strokes from the bulb to the aim point, sparks at the tip
        const ex = BX(), ey = BY, a = Math.atan2(aim.y - ey, aim.x - ex), sx = ex + Math.cos(a) * BR, sy = ey + Math.sin(a) * BR;
        const on = !lost && !(hurt > 0 && Math.sin(now * 60) > 0), fl = 1 + Math.sin(now * 47) * .12;
        if (on) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
          for (const [w, c] of [[52, 'rgba(255,200,60,.10)'], [30, 'rgba(255,210,80,.22)'], [16, 'rgba(255,235,140,.5)'], [7, 'rgba(255,255,230,.95)']]) { ctx.strokeStyle = c; ctx.lineWidth = w * fl; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(aim.x, aim.y); ctx.stroke(); }
          const gl = ctx.createRadialGradient(aim.x, aim.y, 0, aim.x, aim.y, 46 * fl); gl.addColorStop(0, 'rgba(255,255,230,.95)'); gl.addColorStop(.35, 'rgba(255,200,80,.5)'); gl.addColorStop(1, 'rgba(255,140,40,0)');
          ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(aim.x, aim.y, 46 * fl, 0, 7); ctx.fill();
          ctx.lineWidth = 3; for (const p of sparks) { ctx.strokeStyle = p.c; ctx.globalAlpha = Math.min(1, p.life * 4); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .03, p.y - p.vy * .03); ctx.stroke(); }
          ctx.restore(); ctx.lineCap = 'butt';
          ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; for (let j = 0; j < 4; j++) { const q = now * 3 + j * 1.57; ctx.beginPath(); ctx.moveTo(aim.x + Math.cos(q) * 12, aim.y + Math.sin(q) * 12); ctx.lineTo(aim.x + Math.cos(q) * 22, aim.y + Math.sin(q) * 22); ctx.stroke(); }
        }
        // lighthouse: rocky islet, striped tower, gallery with the keeper, and the bulb hero (eyes follow the aim)
        const ty0 = BY + 68, tw0 = 22, tw1 = 34, tyb = 552, wAt = y => tw0 + (y - ty0) / (tyb - ty0) * (tw1 - tw0);
        X.beginPath(); X.ellipse(ex, 546, 78, 22, 0, Math.PI, 0); X.closePath(); ink('#8b8aa8', 4); X.save(); X.beginPath(); X.ellipse(ex, 546, 78, 22, 0, Math.PI, 0); X.clip(); X.fillStyle = '#6f6d92'; el(ex + 18, 552, 78, 22); X.fill(); X.restore(); glint(ex - 40, 534, 18, 4, -.2, .4);
        const TP = () => { X.beginPath(); X.moveTo(ex - tw0, ty0); X.lineTo(ex + tw0, ty0); X.lineTo(ex + tw1, tyb); X.lineTo(ex - tw1, tyb); X.closePath(); };
        TP(); ink('#fff', 4); X.save(); TP(); X.clip();
        for (let j = 0; j < 5; j++) { X.fillStyle = j % 2 ? '#fff' : '#FF4D6D'; X.fillRect(ex - 40, ty0 + j * 40, 80, 40); }
        X.fillStyle = 'rgba(40,20,90,.28)'; X.fillRect(ex + 8, ty0, 40, 200); X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(ex - 24, ty0, 8, 200); X.restore();
        X.beginPath(); X.arc(ex, ty0 + 52, 9, 0, TAU); ink('#9fe3ff', 3); glint(ex - 3, ty0 + 49, 3, 2, -.5, .8);
        rr(ex - 10, 516, 20, 36, 9); ink('#7a4a2a', 3);
        X.strokeStyle = INK; X.lineWidth = 7; X.lineCap = 'round'; X.beginPath(); X.moveTo(ex - 58, BY + 36); X.lineTo(ex + 104, BY + 36); X.moveTo(ex - 56, BY + 36); X.lineTo(ex - 56, BY + 56); X.moveTo(ex + 102, BY + 36); X.lineTo(ex + 102, BY + 56); X.stroke();
        X.strokeStyle = '#cfd8e6'; X.lineWidth = 3; X.stroke();
        { const kk = won ? Math.abs(Math.sin(now * 9)) * 8 : 0; ctx.save(); caos(ex + 86, BY + 56 - kk, 4.4, { mood: won ? 'happy' : lost ? 'sad' : '' }); ctx.restore(); }
        rr(ex - 62, BY + 56, 170, 13, 5); ink('#a7b3c4', 4); X.fillStyle = 'rgba(255,255,255,.4)'; rr(ex - 56, BY + 58, 158, 3, 1.5); X.fill();
        const q = bq * .5, hy = BY + 40; X.save(); X.translate(ex, hy); X.scale(1 + q, 1 - q); X.translate(-ex, -hy);
        for (let j = 0; j < 3; j++) { rr(ex - 20 + j * 2, BY + 38 + j * 7, 40 - j * 4, 6, 3); ink(j % 2 ? '#a7b3c4' : '#d6dde8', 2.5); }
        if (on) { X.save(); X.globalCompositeOperation = 'lighter'; const hg = X.createRadialGradient(ex, ey, BR * .6, ex, ey, BR * 2.2); hg.addColorStop(0, 'rgba(255,230,120,.5)'); hg.addColorStop(1, 'rgba(255,200,60,0)'); X.fillStyle = hg; X.beginPath(); X.arc(ex, ey, BR * 2.2, 0, 7); X.fill(); X.restore(); }
        const bb = lost ? '#8a8899' : hurt > 0 ? '#ffd0c0' : '#FFF6C8';
        X.beginPath(); X.arc(ex, ey, BR, 0, TAU); ink(null, 5); X.save(); X.beginPath(); X.arc(ex, ey, BR, 0, TAU); X.clip(); X.fillStyle = lost ? '#6f6d82' : hurt > 0 ? '#e0a090' : '#f0d27a'; X.fillRect(ex - BR, ey - BR, BR * 2, BR * 2); X.beginPath(); X.arc(ex - 9, ey - 7, BR, 0, TAU); X.fillStyle = bb; X.fill(); X.restore();
        glint(ex - 22, ey - 26, 9, 16, -.5, .75); glint(ex - 33, ey - 5, 3, 5, -.3, .6);
        X.strokeStyle = lost ? '#8a8899' : '#e0a030'; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); for (let j = 0; j <= 12; j++) X.lineTo(ex - 14 + j * 28 / 12, ey + 28 + Math.sin(j * 1.6) * 4); X.stroke();
        const worried = !g.result && rocks.some(o => o.y > 400), mood = lost ? 'dead' : (won || bq > 0) ? 'happy' : hurt > 0 ? 'panic' : 'calm';
        X.fillStyle = won ? 'rgba(255,110,165,.8)' : 'rgba(255,110,165,.5)'; for (const d of [-1, 1]) { el(ex + d * 32, ey + 10, 8, 5); X.fill(); }
        for (const d of [-1, 1]) {
          const x = ex + d * 17, y = ey - 6; eye(x, y, 8.5, [Math.cos(a) * .9, Math.sin(a) * .9], mood, now, d + 2);
          if (mood === 'calm' || mood === 'panic') { X.strokeStyle = INK; X.lineWidth = 4.5; X.lineCap = 'round'; X.beginPath(); const oy = worried || mood === 'panic' ? -11 : -16, iy = worried || mood === 'panic' ? -19 : -11; X.moveTo(x + d * 10, y + oy); X.lineTo(x - d * 8, y + iy); X.stroke(); }
        }
        X.strokeStyle = INK; X.fillStyle = INK; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath();
        if (lost) { X.moveTo(ex - 9, ey + 17); X.quadraticCurveTo(ex, ey + 8, ex + 9, ey + 17); X.stroke(); }
        else if (hurt > 0) { X.ellipse(ex, ey + 14, 6, 7, 0, 0, TAU); X.fill(); }
        else if (worried) { X.moveTo(ex - 8, ey + 15); X.quadraticCurveTo(ex - 3, ey + 10, ex, ey + 14); X.quadraticCurveTo(ex + 3, ey + 18, ex + 8, ey + 13); X.stroke(); }
        else { X.ellipse(ex, ey + 13, 9, won ? 8 : 5, 0, 0, Math.PI); X.fill(); }
        if (worried && !lost) drop(ex + 36, ey - 30 + Math.sin(now * 5) * 2, .9);
        X.restore();
        if (lost) for (let j = 0; j < 3; j++) { const u = (oT * .8 + j / 3) % 1; X.globalAlpha = .6 * (1 - u); X.beginPath(); X.arc(ex + Math.sin(u * 6 + j) * 10, ey - BR - 6 - u * 60, 8 + u * 12, 0, TAU); ink('#9b93b5', 2.5, '#4b4466'); X.globalAlpha = 1; }
        if (won) for (let j = 0; j < 3; j++) { const u = (oT * 1.2 + j / 3) % 1; X.globalAlpha = 1 - u * u; heart(ex - 20 + j * 34 + Math.sin(u * 5 + j) * 6, ey - 62 - u * 60, .9); X.globalAlpha = 1; }
        if (lost) { X.fillStyle = `rgba(8,4,24,${Math.min(.35, oT * 1.2)})`; X.fillRect(-OX, 0, VW, H); }
        if (boom) { const k2 = ease(oT * 4); ctx.save(); ctx.globalAlpha = .55 * (1 - cl(oT * 1.1)); star(boom.x, boom.y, 20 + 130 * k2, 12 + 60 * k2, 12, now * 2, '#FFE14D', 0); ctx.restore(); txt('KABOOM!', boom.x, boom.y + 70 + Math.sin(now * 18) * 4, 60, '#FFE14D'); }
        vignette(.3);
      },
      probe: () => {
        const low = [...rocks].sort((a, b) => b.y - a.y)[0];
        const tgt = low && (!ufo || low.y > 370) ? low : ufo || low || null;
        return { phase, burned, need: NEED, hits, clock: +clock.toFixed(2), finger: FINGER, kb, locked: lock ? lock.id || 'ufo' : null, aim: { x: Math.round(aim.x), y: Math.round(aim.y) }, emitter: { x: BX(), y: BY },
          rocks: rocks.map(o => ({ id: o.id, x: Math.round(o.x), y: Math.round(o.y), r: Math.round(o.r), heat: +o.heat.toFixed(2) })),
          ufo: ufo && { x: Math.round(ufo.x), y: Math.round(ufo.y), heat: +ufo.heat.toFixed(2) },
          target: tgt && { id: tgt.id || 'ufo', x: Math.round(tgt.x), y: Math.round(tgt.y) } };
      },
    };
    return g;
  };
})();
