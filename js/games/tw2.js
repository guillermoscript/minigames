'use strict';
/* Twisted wave 2 — WarioWare: Twisted! inspired tilt microgames.
   Tilt = mouse/touch X (centre level, edges +-35deg) or Left/Right / A/D. World is drawn rotated by the tilt. */
(function () {
  const MAXT = 35 * Math.PI / 180;
  const CREAM = '#FFF1D6', CREAM2 = '#FFE3B0', ORG = '#FF9F43', ORD = '#E8742B';

  /* shared tilt controller */
  function tiltCtl() {
    const s = { v: 0, n: 0, px: W / 2, kd: 0 };
    s.step = function (dt) {
      const l = keys.ArrowLeft || keys.KeyA, r = keys.ArrowRight || keys.KeyD;
      let tg;
      if (l || r) { s.kd = (r ? 1 : 0) - (l ? 1 : 0); tg = s.kd * MAXT; }
      else tg = Math.max(-1, Math.min(1, (s.px - W / 2) / (VW / 2 - 40))) * MAXT;
      s.v += (tg - s.v) * Math.min(1, dt * (l || r ? 7 : 12));
      s.n = s.v / MAXT;
    };
    s.ptr = p => { s.px = p.x; };
    return s;
  }
  const sad = g => g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null;
  const lose = () => { sfx.miss(); sfx.thud(); shake(8, .25); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function poly(pts, fill, o = 4) {
    ctx.beginPath(); pts.forEach(q => ctx.lineTo(q[0], q[1])); ctx.closePath(); ctx.lineJoin = 'round';
    if (o) { ctx.lineWidth = o * 2; ctx.strokeStyle = INK; ctx.stroke(); }
    ctx.fillStyle = fill; ctx.fill();
  }
  function tiltBadge(tl) {   // small level indicator, screen space
    box3(300, 560, 200, 20, '#fff', 3, 3);
    ctx.fillStyle = ORG; ctx.fillRect(400, 560, tl.n * 100, 20);
    ctx.fillStyle = INK; ctx.fillRect(398, 554, 4, 32);
  }
  function spikes(x0, x1, y, dir, n) {   // spike row pointing up (dir=-1)
    const w = (x1 - x0) / n;
    for (let i = 0; i < n; i++) poly([[x0 + i * w, y], [x0 + i * w + w / 2, y + dir * 34], [x0 + (i + 1) * w, y]], '#ddd', 3);
  }

  /* ── 1 SLIDE: slide the cheese into the mouse hole on the ice ── */
  function twSlide(sp) {
    const hx = (Math.random() < .5 ? -1 : 1) * (120 + Math.random() * 80), HW = 46, LIM = 296;
    const tl = tiltCtl();
    let x = -hx * .5 + (Math.random() - .5) * 60, vx = 0, c = 0, sink = 0, fall = 0, ang = 0;
    const g = {
      cmd: 'SLIDE!', hint: 'MOUSE X / ARROWS: TILT THE CHEESE INTO THE HOLE', thint: 'DRAG LEFT / RIGHT TO TILT', dur: 5,
      wide: true, move: tl.ptr, down: tl.ptr,
      update(dt) {
        tl.step(dt); c += dt;
        if (g.result === 'win') { sink += dt; return; }
        if (g.result === 'lose') { fall += dt; return; }
        const G = 640 * (.85 + .15 * sp);
        vx += Math.sin(tl.v) * G * dt; vx *= Math.pow(.62, dt);   // ice: little friction
        x += vx * dt; ang += vx * dt / 40;
        if (x > LIM && vx > 0) { x = LIM; if (Math.abs(vx) > 160) sfx.thud(); vx = -vx * .35; }
        if (x < -LIM && vx < 0) { x = -LIM; if (Math.abs(vx) > 160) sfx.thud(); vx = -vx * .35; }
        if (Math.abs(x) > 252 && !g.result) {      // spiky walls
          g.result = 'lose'; lose(); sfx.zap(); burst(x + 24 * Math.sign(x) * 0, 0, '#FFC93C', 16); ring(400 + x, 300, '#ff4d4d', 80); floatText('OUCH!', 400, 200, '#ff4d4d', 44);
        } else if (Math.abs(x - hx) < HW / 2 - 6 && Math.abs(vx) < 330) {
          g.result = 'win'; vx = 0; sfx.pop(); sfx.coin(); jingleWin(); confetti(400 + hx, 300, 26); burst(400 + hx, 330, '#FFE14D', 14); ring(400 + hx, 340, '#fff', 90); floatText('SQUEAK!', 400, 180, '#5CFF7A', 46); shake(5, .2);
        }
      }, draw(t) {
        bg(CREAM, CREAM2, c);
        ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(tl.v);
        // ground beyond the walls (fills the margins under any tilt)
        ctx.fillStyle = INK; ctx.fillRect(-1400, 50, 2800, 1000); ctx.fillStyle = '#E8C08A'; ctx.fillRect(-1400, 58, 2800, 1000);
        // slab
        ctx.fillStyle = INK; ctx.fillRect(-380, 50, 760, 140);
        ctx.fillStyle = '#BFE9FF'; ctx.fillRect(-372, 58, 744, 124);
        ctx.fillStyle = '#fff'; for (let i = 0; i < 9; i++) { ctx.fillRect(-352 + i * 80 + ((i & 1) ? 20 : 0), 66, 36, 6); }
        ctx.strokeStyle = '#8fd0f0'; ctx.lineWidth = 3; for (let i = 1; i < 9; i++) { ctx.beginPath(); ctx.moveTo(-372 + i * 82.7, 58); ctx.lineTo(-372 + i * 82.7, 182); ctx.stroke(); }
        box(-390, -140, 18, 330, ORD, 4); box(372, -140, 18, 330, ORD, 4);
        // spikes on both walls' feet
        spikes(-372, -280, 50, -1, 4); spikes(280, 372, 50, -1, 4);
        // hole
        ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(hx, 52, HW / 2 + 4, 36, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#3a2b2b'; ctx.beginPath(); ctx.ellipse(hx, 52, HW / 2 - 2, 30, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(hx - 5, 20, 3, 3); // glint
        // mouse
        const mw = g.result === 'win' ? Math.sin(c * 20) * 3 : 0;
        circ(hx + mw, 28 + (g.result === 'win' ? -6 : 0), 14, '#c8c0d0', 3); circ(hx - 12 + mw, 14, 7, '#ffb3c6', 3); circ(hx + 12 + mw, 14, 7, '#ffb3c6', 3);
        ctx.fillStyle = INK; ctx.fillRect(hx - 7 + mw, 24, 4, 5); ctx.fillRect(hx + 3 + mw, 24, 4, 5);
        circ(hx + mw, 36, 3, '#ff6b81', 0);
        // cheese
        const sc = g.result === 'win' ? Math.max(0, 1 - sink * 2.2) : 1, cy = 50 - 26 * sc + (g.result === 'lose' ? Math.min(60, fall * 200) : 0);
        shadow(x, 52, 34, 7, .3);
        ctx.save(); ctx.translate(x, cy); ctx.scale(sc, sc); ctx.rotate(g.result === 'lose' ? 0.4 * Math.sign(x) : Math.sin(ang) * .05);
        poly([[-30, 24], [30, 24], [30, -14], [-4, -28], [-30, -14]], '#FFD23F', 4);
        ctx.fillStyle = '#FFA600'; ctx.beginPath(); ctx.arc(-12, 4, 6, 0, 7); ctx.arc(14, -6, 5, 0, 7); ctx.arc(10, 14, 4, 0, 7); ctx.fill();
        ctx.restore();
        ctx.restore();
        tiltBadge(tl);
        if (g.result === 'win') txt('NOM!', 400, 110, 50, '#5CFF7A'); else if (g.result === 'lose') txt('OUCH!', 400, 110, 50, '#ff4d4d');
        vignette(.2);
      }
    };
    return g;
  }

  /* ── 2 STEER: the tilt is the steering wheel ── */
  function twWheel(sp) {
    const tl = tiltCtl(), RL = 190, RR = 610, rs = Math.sqrt(sp);
    let c = 0, x = 400, off = 0, spin = 0, cones = [], nxt = .5, near = 0, edge = 0;
    const g = {
      cmd: 'STEER!', hint: 'MOUSE X / ARROWS: TURN THE WHEEL, DODGE CONES', thint: 'DRAG LEFT / RIGHT TO STEER', dur: 5, timeWin: true,
      wide: true, move: tl.ptr, down: tl.ptr,
      update(dt) {
        tl.step(dt); c += dt;
        if (g.result) { spin += dt * 14; return; }
        const V = 330 * (.85 + .15 * sp); off += V * dt;
        x += tl.n * 420 * dt;
        if (x < RL + 24) { x = RL + 24; if (edge <= 0) { sfx.thud(); edge = .3; burst(x - 20, 460, '#fff', 4, 140); } }
        if (x > RR - 24) { x = RR - 24; if (edge <= 0) { sfx.thud(); edge = .3; burst(x + 20, 460, '#fff', 4, 140); } }
        edge -= dt;
        nxt -= dt;
        if (nxt <= 0) {
          nxt = (.5 + Math.random() * .25) / rs;
          let cx = RL + 36 + Math.random() * (RR - RL - 72);
          if (cones.length && Math.abs(cones[cones.length - 1].x - cx) > 260 && cones[cones.length - 1].y < 120) cx = cones[cones.length - 1].x + Math.sign(cx - cones[cones.length - 1].x) * 110;
          cones.push({ x: clamp(cx, RL + 30, RR - 30), y: -40, ok: false });
        }
        for (const q of cones) {
          q.y += V * dt;
          if (Math.hypot(q.x - x, q.y - 455) < 38 && !g.result) {
            g.result = 'lose'; lose(); sfx.splat(); burst(q.x, q.y, ORG, 14); ring(q.x, q.y, '#fff', 80); floatText('BONK!', q.x, 380, '#ff4d4d', 46); q.hit = 1;
          } else if (!q.ok && q.y > 500) { q.ok = true; near++; if (Math.abs(q.x - x) < 70) { sfx.blip(near % 7); floatText('NICE', q.x, 430, '#fff', 24); } }
        }
        cones = cones.filter(q => q.y < 680);
      }, draw(t) {
        // grass
        ctx.fillStyle = '#9BDB6A'; ctx.fillRect(-OX, 0, VW, H);
        ctx.fillStyle = '#86cc55'; for (let k = 0; k * 200 < OX + 60; k++) for (let i = 0; i < 12; i++) { const y = ((i * 70 + k * 37 + off * .9) % 840) - 120; ctx.fillRect(40 + (i % 3) * 20 - k * 200, y, 70, 18); ctx.fillRect(660 - (i % 3) * 20 + k * 200, y + 30, 70, 18); }
        ctx.fillStyle = INK; ctx.fillRect(RL - 14, 0, RR - RL + 28, H); ctx.fillStyle = '#6b6b78'; ctx.fillRect(RL, 0, RR - RL, H);
        ctx.fillStyle = '#fff'; for (let i = 0; i < 9; i++) { const y = ((i * 90 + off) % 810) - 90; ctx.fillRect(RL + 4, y, 10, 50); ctx.fillRect(RR - 14, y, 10, 50); }
        ctx.fillStyle = '#FFE14D'; for (let i = 0; i < 9; i++) { const y = ((i * 90 + off) % 810) - 90; ctx.fillRect(398, y, 8, 44); }
        // cones
        for (const q of cones) {
          if (q.hit) { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(spin * .3); shadow(0, 24, 22, 6, .3); } else { ctx.save(); ctx.translate(q.x, q.y); shadow(0, 24, 22, 6, .3); }
          poly([[0, -26], [22, 22], [-22, 22]], ORG, 4); ctx.fillStyle = '#fff'; ctx.fillRect(-12, 0, 24, 8); box(-26, 20, 52, 8, ORD, 3);
          ctx.restore();
        }
        // car (top view)
        const lean = tl.n * .12 + (g.result ? Math.sin(spin) * .4 : 0);
        ctx.save(); ctx.translate(x, 455); ctx.rotate(lean);
        shadow(4, 8, 32, 44, .3);
        box(-24, -42, 48, 84, '#E8433A', 5); box(-16, -22, 32, 26, '#BFEFFF', 4); box(-20, 14, 40, 14, '#c0302a', 3);
        box(-31, -34, 8, 18, INK, 0); box(23, -34, 8, 18, INK, 0); box(-31, 16, 8, 18, INK, 0); box(23, 16, 8, 18, INK, 0);
        ctx.fillStyle = '#FFE14D'; ctx.fillRect(-20, -46, 10, 5); ctx.fillRect(10, -46, 10, 5);
        ctx.restore();
        claude(x, 462, 2.4, { mood: sad(g) });
        // big wheel
        ctx.save(); ctx.translate(100 - OX * .8, 470); ctx.rotate(g.result ? spin : tl.v * 2.6);
        shadow(0, 100, 80, 14, .25);
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, 90, 0, 7); ctx.fill();
        ctx.fillStyle = '#3b3550'; ctx.beginPath(); ctx.arc(0, 0, 80, 0, 7); ctx.fill();
        ctx.fillStyle = CREAM; ctx.beginPath(); ctx.arc(0, 0, 62, 0, 7); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke();
        ctx.fillStyle = INK; for (const a of [0, 2.1, 4.2]) { ctx.save(); ctx.rotate(a); ctx.fillRect(-9, -2, 18, 66); ctx.restore(); }
        ctx.fillStyle = INK; for (const a of [0, 2.1, 4.2]) { ctx.save(); ctx.rotate(a); ctx.fillStyle = ORG; ctx.fillRect(-5, 2, 10, 60); ctx.restore(); }
        circ(0, 0, 18, ORG, 4); ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(0, -90); ctx.lineTo(10, -70); ctx.lineTo(-10, -70); ctx.fill();
        ctx.fillStyle = '#FFE14D'; ctx.fillRect(-6, -88, 12, 14);
        ctx.restore();
        // progress
        box3(W + OX - 160, 20, 140, 18, '#fff', 3, 3); ctx.fillStyle = '#5CFF7A'; ctx.fillRect(W + OX - 160, 20, 140 * clamp(c / (5 / Math.sqrt(sp)), 0, 1), 18);
        vignette(.2);
      }
    };
    return g;
  }

  /* ── 3 COLLECT: roll the ball over every coin, skip the holes ── */
  function twCoins(sp) {
    const tl = tiltCtl(), LIM = 330 + OX * .6;
    const nC = 4 + (Math.random() * 2 | 0);
    const holes = [-170, 120].map(h => h + (Math.random() - .5) * 40);
    const hx0 = holes[0], hx1 = holes[1];
    const coins = [];
    const zones = [-310, -240, -60, 40, 230, 310];
    shuffle(zones.slice()).slice(0, nC).forEach(z => coins.push({ x: z, got: false }));
    let x = (hx0 + hx1) / 2 - 20, vx = 0, c = 0, rot = 0, fall = 0, left = nC, pulse = 0;
    const g = {
      cmd: 'COLLECT!', hint: 'MOUSE X / ARROWS: TILT, GET ALL COINS, AVOID HOLES', thint: 'DRAG LEFT / RIGHT TO TILT', dur: 6,
      wide: true, move: tl.ptr, down: tl.ptr,
      update(dt) {
        tl.step(dt); c += dt; pulse = Math.max(0, pulse - dt);
        if (g.result === 'lose') { fall += dt; return; }
        if (g.result === 'win') return;
        const G = 660 * (.85 + .15 * sp);
        vx += Math.sin(tl.v) * G * dt; vx *= Math.pow(.55, dt); x += vx * dt; rot += vx * dt / 24;
        if (x > LIM && vx > 0) { x = LIM; vx = -vx * .5; sfx.thud(); }
        if (x < -LIM && vx < 0) { x = -LIM; vx = -vx * .5; sfx.thud(); }
        for (const q of coins) if (!q.got && Math.abs(q.x - x) < 36) {
          q.got = true; left--; pulse = .2; sfx.coin(); burst(400 + q.x, 300 + 0, '#FFE14D', 10); ring(400 + q.x, 300, '#fff', 50, .3); floatText('+1', 400 + q.x, 230, '#FFE14D', 30);
        }
        for (const h of holes) if (Math.abs(x - h) < 22 && Math.abs(vx) < 200 && !g.result) {
          g.result = 'lose'; x = h; lose(); sfx.whoosh(false); burst(400 + h, 340, '#fff', 10); floatText('PLOP!', 400 + h, 220, '#ff4d4d', 44);
        }
        if (left <= 0 && !g.result) { g.result = 'win'; jingleWin(); confetti(400, 300, 30); shake(5, .2); floatText('ALL COINS!', 400, 150, '#5CFF7A', 46); }
      }, draw(t) {
        bg(CREAM2, CREAM, c);
        ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(tl.v);
        // platform segments with gaps
        const segs = [-390, hx0 - 30, hx0 + 30, hx1 - 30, hx1 + 30, 390];
        ctx.fillStyle = INK; ctx.fillRect(-1400, 62, 2800, 112);
        const P = (a, b) => { ctx.fillStyle = ORG; ctx.fillRect(a, 66, b - a, 104); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(a, 66, b - a, 10); };
        P(-1400, hx0 - 30); P(hx0 + 30, hx1 - 30); P(hx1 + 30, 1400);
        for (const h of holes) {   // holes: dark pits
          ctx.fillStyle = INK; ctx.fillRect(h - 36, 56, 72, 130); ctx.fillStyle = '#4a3340'; ctx.fillRect(h - 30, 62, 60, 118);
          ctx.fillStyle = '#fff'; ctx.fillRect(h - 10, 100 + (now * 40 % 30), 4, 12); ctx.fillRect(h + 8, 130 + (now * 30 % 30), 4, 10);
          spikes(h - 30, h + 30, 180, -1, 4);
        }
        ctx.fillStyle = ORD; for (let i = -9; i < 18; i++) ctx.fillRect(-380 + i * 90, 140, 30, 8);
        // coins
        for (const q of coins) if (!q.got) { shadow(q.x, 64, 16, 4, .25); token(q.x, 22 + Math.sin(c * 4 + q.x) * 4, 16); }
        // ball
        const by = g.result === 'lose' ? 38 + fall * fall * 900 : 38 + (g.result === 'win' ? -Math.abs(Math.sin(c * 8)) * 14 : 0);
        shadow(x, 64, 24, 6, g.result === 'lose' ? .1 : .3);
        ctx.save(); ctx.translate(x, by); ctx.rotate(rot);
        circ(0, 0, 24, '#E8433A', 4); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 24, .2, 1.4); ctx.lineTo(0, 0); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-14, -16, 8, 8);
        ctx.restore();
        ctx.restore();
        // counter
        for (let i = 0; i < nC; i++) circ(300 + i * (200 / Math.max(1, nC - 1)), 60, 12, i < nC - left ? '#FFC93C' : 'rgba(20,16,28,.25)', 3);
        tiltBadge(tl);
        if (g.result === 'lose') txt('SPLOOP!', 400, 140, 50, '#ff4d4d');
        vignette(.2);
      }
    };
    return g;
  }

  /* ── 4 BALANCE: keep Claude upright on the half-pipe against gusts ── */
  function twSkate(sp) {
    const tl = tiltCtl();
    let c = 0, bal = 0, bv = 0, gust = 0, gt = 0, gtarget = 0, wind = [];
    const surf = x => -110 + 270 * (x / 360) * (x / 360);
    const dsurf = x => 540 * x / (360 * 360);
    gtarget = (Math.random() < .5 ? -1 : 1) * 2;
    const g = {
      cmd: 'BALANCE!', hint: 'MOUSE X / ARROWS: TILT AGAINST THE LEAN', thint: 'DRAG LEFT / RIGHT TO COUNTER LEAN', dur: 5, timeWin: true,
      wide: true, move: tl.ptr, down: tl.ptr,
      update(dt) {
        tl.step(dt); c += dt;
        if (g.result === 'lose') { bv += dt * 5; bal += bv * dt * Math.sign(bal || 1); return; }
        gt -= dt;
        if (gt <= 0) { gt = .55 + Math.random() * .4; gtarget = (Math.random() < .5 ? -1 : 1) * (1.8 + Math.random() * 1.8) * (.85 + .15 * sp); if (Math.random() < .5) { sfx.whoosh(gtarget > 0); wind.push({ y: 80 + Math.random() * 140, d: Math.sign(gtarget), t: 0 }); } }
        gust += (gtarget - gust) * Math.min(1, dt * 5);
        bv += (2.6 * bal + gust + 7.5 * tl.n) * dt; bv *= Math.pow(.35, dt); bal += bv * dt;
        for (const w of wind) w.t += dt; wind = wind.filter(w => w.t < .8);
        if (Math.abs(bal) > 1) { g.result = 'lose'; bv = 1; lose(); sfx.splat(); burst(400, 400, '#fff', 12); floatText('WIPEOUT!', 400, 180, '#ff4d4d', 46); }
        else if (Math.abs(bal) > .7 && Math.random() < dt * 8) sfx.tick();
      }, draw(t) {
        bg(CREAM, CREAM2, c);
        ctx.save(); ctx.translate(W / 2, H / 2 + 20); ctx.rotate(tl.v);
        // half-pipe bowl
        ctx.beginPath(); ctx.moveTo(-1300, surf(-1300)); for (let x = -1300; x <= 1300; x += 30) ctx.lineTo(x, surf(clamp(x, -360, 360)) + (Math.abs(x) > 360 ? (Math.abs(x) - 360) * Math.sign(0) - (Math.abs(x) - 360) * 2.2 : 0));
        ctx.lineTo(1300, 1200); ctx.lineTo(-1300, 1200); ctx.closePath(); ctx.fillStyle = INK; ctx.fill();
        ctx.save(); ctx.translate(0, 8); ctx.beginPath(); ctx.moveTo(-1300, surf(-1300)); for (let x = -1300; x <= 1300; x += 30) ctx.lineTo(x, surf(clamp(x, -360, 360)) + (Math.abs(x) > 360 ? -(Math.abs(x) - 360) * 2.2 : 0));
        ctx.lineTo(1300, 1200); ctx.lineTo(-1300, 1200); ctx.closePath(); ctx.fillStyle = ORG; ctx.fill(); ctx.restore();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.beginPath(); for (let x = -340; x <= 340; x += 20) ctx.lineTo(x, surf(x) + 8 + 2); ctx.stroke();
        ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); for (let x = -340; x <= 340; x += 20) ctx.lineTo(x, surf(x) + 50); ctx.stroke();
        // skater
        const sx = g.result === 'lose' ? 0 : 200 * Math.sin(c * 1.5), sy = surf(sx), sl = Math.atan(dsurf(sx));
        const fy = g.result === 'lose' ? sy - 10 + Math.max(0, bv - 1) * 0 : sy;
        shadow(sx, sy + 12, 44, 8, .25);
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(sl);
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-24, 0, 11, 0, 7); ctx.arc(24, 0, 11, 0, 7); ctx.fill();
        ctx.fillStyle = '#e8dcff'; ctx.beginPath(); ctx.arc(-24, 0, 6, 0, 7); ctx.arc(24, 0, 6, 0, 7); ctx.fill();
        box(-42, -16, 84, 10, '#4DB8FF', 3); ctx.fillStyle = '#fff'; ctx.fillRect(-14, -14, 28, 4);
        ctx.save(); ctx.translate(0, -16); ctx.rotate(bal * .65 - sl * 0);
        if (g.result === 'lose') ctx.translate(Math.sign(bal) * (bv * 20), -bv * 10);
        claude(0, 0, 4.4, { mood: sad(g) });
        ctx.restore(); ctx.restore();
        ctx.restore();
        // wind streaks
        for (const w of wind) { const k = w.t / .8; ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.lineCap = 'round'; const x0 = w.d > 0 ? 80 - OX + k * (VW - 200) : W + OX - 80 - k * (VW - 200); ctx.beginPath(); ctx.moveTo(x0, w.y); ctx.lineTo(x0 + w.d * 90, w.y); ctx.stroke(); ctx.lineCap = 'butt'; ctx.globalAlpha = 1; }
        // balance bar
        box3(200, 26, 400, 28, '#fff', 4, 4);
        ctx.fillStyle = '#5CFF7A'; ctx.fillRect(200 + 400 * .35, 26, 400 * .3, 28);
        ctx.fillStyle = '#FFC93C'; ctx.fillRect(200 + 400 * .15, 26, 400 * .2, 28); ctx.fillRect(200 + 400 * .65, 26, 400 * .2, 28);
        ctx.fillStyle = '#ff4d4d'; ctx.fillRect(200, 26, 400 * .15, 28); ctx.fillRect(200 + 400 * .85, 26, 400 * .15, 28);
        const mx = 400 + clamp(bal, -1, 1) * 200; ctx.fillStyle = INK; ctx.fillRect(mx - 8, 18, 16, 44); ctx.fillStyle = '#fff'; ctx.fillRect(mx - 4, 22, 8, 36);
        tiltBadge(tl);
        vignette(.2);
      }
    };
    return g;
  }

  reg('tw_slide', twSlide, 'SLIDE!');
  reg('tw_wheel', twWheel, 'STEER!');
  reg('tw_coins', twCoins, 'COLLECT!');
  reg('tw_skate', twSkate, 'BALANCE!');
})();
