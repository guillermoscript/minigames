'use strict';
/* LIGHT HERO (after Mega Microgame$' "Alien Laser Hero"): grumpy meteors fall on a night city. A giant light bulb on a
   lighthouse fires a continuous beam at the pointer (touch aims a bit above the finger; arrow keys accelerate and the
   tip snaps onto nearby rocks once released). Keep the bright tip (or, slower, the beam) on a rock to fry it;
   after 6 rocks a UFO flies in dropping more: hold the beam on it to blow it up. 3 rocks on the city = lights out. */
(function () {
  BOSSES.laser = function (sp, s) {
    const k = Math.min(sp, 1.3) / 1.3, NEED = 6, LIVES = 3, TIP = 36, ROCK_T = .3, UFO_T = .6, BODY = .4, FINGER = 64, LOCK_R = 150, LOCK_BREAK = .35;
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
    const g = {
      cmd: 'BOSS!', hint: 'ZAP ROCKS: MOUSE OR ARROWS!', thint: 'DRAG THE LIGHT TO ROCKS!', dur: 12, boss: true, wide: true,
      move(p) { aim.x = p.x; aim.y = p.y - (p.touch ? FINGER : 0); tipR = p.touch ? TIP + 16 : TIP; kb = false; lock = null; },   // touch: a wider tip that floats above the finger
      down(p) { g.move(p); },
      update(dt) {
        clock += dt; bq = Math.max(0, bq - dt); hurt = Math.max(0, hurt - dt);
        for (let i = sparks.length - 1; i >= 0; i--) { const p = sparks[i]; p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) sparks.splice(i, 1); }
        for (const d of dents) d.t += dt;
        if (ufo) ufo.hit = Math.max(0, ufo.hit - dt);
        if (g.result) { if (ufo && g.result === 'win') ufo.y += 400 * dt; return; }
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
        // night sky, stars, moon, far skyline
        const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#0c0a26'); sky.addColorStop(.6, '#2a1650'); sky.addColorStop(1, '#5b2a6e');
        ctx.fillStyle = sky; ctx.fillRect(-OX, 0, VW, H);
        for (const p of stars) if (p.x > -OX && p.x < W + OX) { ctx.globalAlpha = .4 + .6 * Math.abs(Math.sin(t * 1.5 + p.ph)); ctx.fillStyle = '#fff'; ctx.fillRect(p.x, p.y, p.s, p.s); }
        ctx.globalAlpha = 1;
        const mx = W + OX - 70, lost = g.result === 'lose', won = g.result === 'win';
        ctx.save(); ctx.beginPath(); ctx.arc(mx, 165, 34, 0, 7); ctx.arc(mx + 16, 155, 30, 0, 7, true); ctx.clip('evenodd'); circ(mx, 165, 30, '#FFF3C4', 4); ctx.restore();   // crescent moon
        ctx.fillStyle = '#231a4a'; for (const b of far) ctx.fillRect(b.x, 548 - b.h, b.w, b.h);
        // HUD
        if (phase === 'rocks') txt(window.t('ROCKS {n} / {need}', { n: burned, need: NEED }), W / 2, 104, 30, '#FFE14D');
        else {
          const hurry = !g.result && dur - tt < 2.5;
          txt(hurry ? 'HURRY!' : 'ZAP THE UFO!', W / 2, 100, hurry ? 30 + Math.sin(now * 20) * 3 : 28, hurry && Math.sin(now * 20) > 0 ? '#FF4D6D' : '#5CFF7A');
          const hv = ufo ? Math.min(1, ufo.heat) : 1; box3(W / 2 - 150, 120, 300, 16, '#14102a', 4, 3);
          ctx.fillStyle = hv > .7 ? '#fff' : '#FF8A3D'; ctx.fillRect(W / 2 - 150, 120, 300 * hv, 16);
        }
        for (let i = 0; i < LIVES; i++) { const x = W / 2 + 200 + i * 30, on = i >= hits; circ(x, 108, 10, on ? '#FFE14D' : '#3a3550', 3); box(x - 5, 120, 10, 6, '#9aa0b4', 2); }
        // city: buildings with lit windows; dents knock the lights out nearby
        for (const b of city) {
          if (b.x > W + OX || b.x + b.w < -OX) continue;
          const dark = lost || dents.some(d => d.x > b.x - 40 && d.x < b.x + b.w + 40);
          box(b.x, b.top, b.w, 600 - b.top, b.col, 4);
          let r = b.win;
          for (let y = b.top + 12; y < 548; y += 22) for (let x = b.x + 9; x < b.x + b.w - 14; x += 18) { r = r * 1103515245 + 12345 & 0x7fffffff; ctx.fillStyle = !dark && r % 5 > 1 ? '#FFE14D' : '#1d1838'; ctx.fillRect(x, y, 10, 12); }
        }
        ctx.fillStyle = INK; ctx.fillRect(-OX, 548, VW, 52);
        for (const d of dents) {   // crater + smoke
          ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(d.x, d.y + 4, 34, 18, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#FF8A3D'; ctx.beginPath(); ctx.ellipse(d.x, d.y + 6, 18, 8, 0, 0, 7); ctx.fill();
          for (let j = 0; j < 3; j++) { const u = (d.t * .6 + j / 3) % 1; ctx.globalAlpha = .5 * (1 - u); circ(d.x + Math.sin(u * 6 + j) * 10, d.y - u * 90, 10 + u * 16, '#6b6380', 0); }
          ctx.globalAlpha = 1;
        }
        // UFO (drawn under the beam)
        if (ufo) {
          const x = ufo.x, y = ufo.y, h = Math.min(1, ufo.heat), jit = h * 4 + (ufo.hit ? 2 : 0);
          ctx.save(); ctx.translate(x + (Math.random() - .5) * jit, y + (Math.random() - .5) * jit); if (won) ctx.rotate(Math.sin(now * 30) * .4); ctx.scale(1.25, 1.25);
          ctx.globalAlpha = .25 + .15 * Math.sin(t * 9); ctx.fillStyle = '#5CFF7A'; ctx.beginPath(); ctx.moveTo(-26, 18); ctx.lineTo(26, 18); ctx.lineTo(44, 120); ctx.lineTo(-44, 120); ctx.fill(); ctx.globalAlpha = 1;
          ctx.strokeStyle = INK; ctx.lineWidth = 4;
          ctx.fillStyle = '#bfe9ff'; ctx.beginPath(); ctx.ellipse(0, -10, 30, 28, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
          circ(0, -12, 13, '#8a7a6a', 3); ctx.fillStyle = INK; ctx.fillRect(-8, -18, 5, 5); ctx.fillRect(3, -18, 5, 5); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-10, -24); ctx.lineTo(-2, -20); ctx.moveTo(10, -24); ctx.lineTo(2, -20); ctx.stroke();
          ctx.lineWidth = 4; ctx.fillStyle = `rgb(${150 + h * 105},${165 - h * 100 | 0},${190 - h * 160 | 0})`; ctx.beginPath(); ctx.ellipse(0, 4, 74, 22, 0, 0, 7); ctx.fill(); ctx.stroke();
          for (let j = 0; j < 6; j++) circ(-55 + j * 22, 6, 5, (Math.floor(t * 8) + j) % 2 ? '#FFE14D' : '#FF4D6D', 2);
          ctx.restore();
        }
        // grumpy meteors with flame trails, glowing red as they heat up
        for (const o of rocks) {
          const h = Math.min(1, o.heat), sc = easeBack(o.pop), r = o.r * sc, jit = h * 3;
          const x = o.x + (Math.random() - .5) * jit, y = o.y + (Math.random() - .5) * jit;
          if (h > .05) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const hg = ctx.createRadialGradient(x, y, r * .5, x, y, r * 1.9); hg.addColorStop(0, `rgba(255,${120 + h * 100 | 0},60,${h * .75})`); hg.addColorStop(1, 'rgba(255,80,30,0)'); ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, 7); ctx.fill(); ctx.restore(); }
          ctx.fillStyle = '#FF8A3D'; ctx.globalAlpha = .8; ctx.beginPath(); ctx.moveTo(x - r * .8, y - r * .2); ctx.quadraticCurveTo(x - o.vx * .3, y - r * 3.2 - Math.sin(t * 30) * 6, x + r * .8, y - r * .2); ctx.fill();
          ctx.fillStyle = '#FFE14D'; ctx.beginPath(); ctx.moveTo(x - r * .45, y - r * .3); ctx.quadraticCurveTo(x - o.vx * .2, y - r * 2.1, x + r * .45, y - r * .3); ctx.fill(); ctx.globalAlpha = 1;
          ctx.beginPath(); o.pts.forEach((q, j) => { const a = o.rot + j * Math.PI * 2 / 9; ctx.lineTo(x + Math.cos(a) * r * q, y + Math.sin(a) * r * q); }); ctx.closePath();
          const u = Math.max(0, h - .55) / .45;   // grey rock -> red-hot -> yellow-white
          ctx.fillStyle = h < .55 ? `rgb(${138 + h * 212 | 0},${122 - h * 60 | 0},${106 - h * 120 | 0})` : `rgb(255,${89 + u * 150 | 0},${40 + u * 130 | 0})`; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.fill(); ctx.stroke();
          ctx.fillStyle = 'rgba(20,16,28,.25)'; ctx.beginPath(); ctx.arc(x + r * .35, y + r * .35, r * .2, 0, 7); ctx.arc(x - r * .45, y + r * .2, r * .12, 0, 7); ctx.fill();
          const ew = h > .3 ? r * .2 : r * .14;   // face: angry brows, then scared wide eyes + O mouth when hot
          circ(x - r * .3, y - r * .1, ew, '#fff', 2.5); circ(x + r * .3, y - r * .1, ew, '#fff', 2.5);
          ctx.fillStyle = INK; ctx.fillRect(x - r * .3 - 2.5, y - r * .1 - 2.5 - (h > .3 ? 3 : 0), 5, 5); ctx.fillRect(x + r * .3 - 2.5, y - r * .1 - 2.5 - (h > .3 ? 3 : 0), 5, 5);
          ctx.lineWidth = 3.5; ctx.beginPath();
          if (h > .3) { ctx.moveTo(x - r * .5, y - r * .5); ctx.lineTo(x - r * .15, y - r * .6); ctx.moveTo(x + r * .5, y - r * .5); ctx.lineTo(x + r * .15, y - r * .6); ctx.stroke(); circ(x, y + r * .4, r * .14, INK, 0); }
          else { ctx.moveTo(x - r * .55, y - r * .48); ctx.lineTo(x - r * .1, y - r * .28); ctx.moveTo(x + r * .55, y - r * .48); ctx.lineTo(x + r * .1, y - r * .28); ctx.moveTo(x - r * .25, y + r * .45); ctx.lineTo(x + r * .25, y + r * .38); ctx.stroke(); }
          if (h > .3) { ctx.fillStyle = '#9fe4ff'; ctx.beginPath(); ctx.ellipse(x + r * .75, y - r * .55, 3.5, 6, .3, 0, 7); ctx.fill(); }
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
        // lighthouse tower + the bulb hero (eyes follow the aim)
        const tw = 34; ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(ex - tw - 4, 552); ctx.lineTo(ex - 22, BY + 68); ctx.lineTo(ex + 22, BY + 68); ctx.lineTo(ex + tw + 4, 552); ctx.fill();
        for (let j = 0; j < 4; j++) { const y0 = BY + 72 + j * 40, y1 = y0 + 40, w0 = 18 + (y0 - BY - 72) * .07, w1 = 18 + (Math.min(548, y1) - BY - 72) * .07; ctx.fillStyle = j % 2 ? '#fff' : '#FF4D6D'; ctx.beginPath(); ctx.moveTo(ex - w0, y0); ctx.lineTo(ex + w0, y0); ctx.lineTo(ex + w1, Math.min(548, y1)); ctx.lineTo(ex - w1, Math.min(548, y1)); ctx.fill(); }
        box(ex - 30, BY + 58, 60, 12, '#7d8a9c', 4);
        const q = bq * .5, hy = BY + 40; ctx.save(); ctx.translate(ex, hy); ctx.scale(1 + q, 1 - q); ctx.translate(-ex, -hy);
        for (let j = 0; j < 3; j++) box(ex - 20 + j * 2, BY + 38 + j * 7, 40 - j * 4, 5, j % 2 ? '#a7b3c4' : '#c9d2de', 3);
        if (on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const hg = ctx.createRadialGradient(ex, ey, BR * .6, ex, ey, BR * 2.2); hg.addColorStop(0, 'rgba(255,230,120,.5)'); hg.addColorStop(1, 'rgba(255,200,60,0)'); ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(ex, ey, BR * 2.2, 0, 7); ctx.fill(); ctx.restore(); }
        circ(ex, ey, BR, lost ? '#8a8899' : hurt > 0 ? '#ffd0c0' : '#FFF6C8', 5);
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(ex - 20, ey - 24, 10, 16, -.5, 0, 7); ctx.fill();
        ctx.strokeStyle = '#e0a030'; ctx.lineWidth = 3; ctx.beginPath(); for (let j = 0; j <= 12; j++) ctx.lineTo(ex - 14 + j * 28 / 12, ey + 26 + Math.sin(j * 1.6) * 5); ctx.stroke();
        const lx = Math.cos(a) * 5, ly = Math.sin(a) * 5; ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round';
        for (const d of [-1, 1]) {
          const x = ex + d * 17, y = ey - 6;
          if (lost) { ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke(); }
          else if (won || bq > 0) { ctx.beginPath(); ctx.moveTo(x - 7, y + 4); ctx.lineTo(x, y - 4); ctx.lineTo(x + 7, y + 4); ctx.stroke(); }
          else { circ(x, y, 9, '#fff', 3); circ(x + lx, y + ly, 4.5, INK, 0); ctx.beginPath(); ctx.moveTo(x - 10, y - 15 - (hurt > 0 ? -3 * d : 0)); ctx.lineTo(x + 8, y - 13 + d * 2); ctx.stroke(); }
        }
        ctx.beginPath(); if (lost || hurt > 0) { ctx.moveTo(ex - 9, ey + 15); ctx.quadraticCurveTo(ex, ey + 6, ex + 9, ey + 15); ctx.stroke(); }
        else { ctx.fillStyle = INK; ctx.ellipse(ex, ey + 13, 9, won ? 8 : 5, 0, 0, Math.PI); ctx.fill(); }
        ctx.lineCap = 'butt'; ctx.restore();
        if (boom) txt('KABOOM!', boom.x, boom.y + Math.sin(now * 18) * 4, 80, '#FFE14D');
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
