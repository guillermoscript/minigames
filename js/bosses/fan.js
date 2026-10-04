'use strict';
/* BIGGEST FAN (after Smooth Moves' Wario-stage boss): bugs march at Claude in 2 waves, then an armoured big bug.
   Wave the mouse (or alternate ←/→) to swing a giant paper fan; every stroke slides all planted bugs back a bit. */
(function () {
  BOSSES.fan = function (sp, s) {
    const k = Math.min(sp, 1.3) / 1.3, LANES = [305, 400, 495], LSC = [.85, 1, 1.15];
    // [lane, where it plants (u), big?]: bugs run in, plant on screen, then march; u=0 is Claude, u=1 the right edge
    const WAVES = [[[0, .86], [2, .78], [1, .7]], [[1, .9], [0, .82], [2, .74], [1, .66]], [[1, .8, true]]];
    const bugs = [], gone = [], winds = [];
    let wave = 0, waveT = .01, waveAt = 0, clock = 0, last = 0, lastKey = 0, fanDir = 1, fanA = .35, fanK = 0, strokes = 0, biter = null, biteT = 0;
    let lx = null, ly = 0, sx = 0, sy = 0, trav = 0, t0 = 0;
    const cx = () => 130 - OX, ux = u => cx() + 120 + u * (W + OX - 45 - cx() - 120);
    const cssK = () => { const r = cv.getBoundingClientRect(); return r.height ? r.height / H : 1; };   // game px -> CSS px
    const spawn = () => {
      for (const [l, eu, big] of WAVES[wave]) bugs.push({ l, u: 1.15 + Math.random() * .1, eu, vb: 0, big: !!big, m: big ? 1.5 : 1, walk: (big ? .14 : .23) * k, on: false, hit: 0, land: 0, ph: Math.random() * 6 });
      wave++; waveAt = clock; floatText(['WAVE 1!', 'WAVE 2!', 'BIG ONE!'][wave - 1], W / 2, 200, wave === 3 ? '#FF4D6D' : '#FFE14D', 52);
      if (wave === 3) { sfx.thud(); shake(8, .3); } else { sfx.tickHi(); snd(660, .1, 'square', .04, .08); }
    };
    /* one swing of the fan: str 0..1 (swings faster than 10/s are weakened); same push at any distance, no stalemate band */
    const stroke = str => {
      if (g.result || !clock) return;
      str *= Math.min(1, (clock - last) / .1); last = clock; if (str < .12) return;
      strokes++; fanDir = -fanDir; fanK = 1; sfx.whoosh(fanDir > 0); snd(fanDir > 0 ? 300 : 240, .08, 'triangle', .04 * str);
      for (let i = 0; i < 3 + str * 3; i++) winds.push({ x: ux(0) - 60 + Math.random() * 60, y: LANES[i % 3] - 30 + Math.random() * 50, len: 50 + Math.random() * 90 * str, life: .55, a: .4 + .6 * str });
      for (const b of bugs) if (b.on) { b.vb += str * .92 / b.m; b.hit = .15; }
    };
    const lose = b => {
      g.result = 'lose'; biter = b; sfx.splat(); sfx.buzz(); shake(12, .4); burst(cx() + 30, 420, '#FF4D4D', 18); ring(cx() + 30, 420, '#fff', 110);
      floatText('CHOMP!', cx() + 70, 190, '#FF4D6D', 52);
    };
    const g = {
      cmd: 'BOSS!', hint: 'WAVE THE MOUSE (OR ← →)!', thint: 'SWIPE BACK AND FORTH!', dur: 10, boss: true, wide: true,
      key(e) {
        const side = e.code === 'ArrowLeft' || e.code === 'KeyA' ? -1 : e.code === 'ArrowRight' || e.code === 'KeyD' ? 1 : 0;
        if (side && side !== lastKey) { lastKey = side; stroke(1); }
      },
      down(p) { lx = p.x; ly = p.y; sx = sy = trav = 0; t0 = clock; },
      move(p) {   // hover (mouse) or drag (touch): every reversal is one stroke; strength from CSS-px speed so window size doesn't matter
        if (lx === null) { lx = p.x; ly = p.y; return; }
        const dx = p.x - lx, dy = p.y - ly, d = Math.abs(dx) + Math.abs(dy); lx = p.x; ly = p.y; if (d < 2) return;
        if (dx * sx + dy * sy < 0 && trav > 30 || trav > 300) {
          const c = trav * cssK(); stroke(c < 30 ? 0 : Math.min(1, Math.max(.6, c / Math.max(.05, clock - t0) / 800))); sx = sy = trav = 0; t0 = clock;
        }
        sx += dx; sy += dy; trav += d;
      },
      update(dt) {
        clock += dt; fanK = Math.max(0, fanK - dt * 4); fanA += (fanDir * .35 - fanA) * Math.min(1, dt * 22); biteT += dt;
        for (let i = winds.length - 1; i >= 0; i--) { const w = winds[i]; w.x += 1500 * dt; w.life -= dt; if (w.life <= 0) winds.splice(i, 1); }
        for (let i = gone.length - 1; i >= 0; i--) { const o = gone[i]; o.vy += 900 * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.r += o.vr * dt; o.life -= dt; if (o.life <= 0) gone.splice(i, 1); }
        for (const b of bugs) { b.hit = Math.max(0, b.hit - dt); b.land = Math.max(0, b.land - dt); }
        if (g.result) return;
        if (!bugs.length) {
          if (wave === 3) { g.result = 'win'; confetti(W / 2, 300, 60); sfx.sparkle(); shake(10, .35); ring(W / 2, 300, '#FFE14D', 240, .6); return; }
          waveT -= dt; if (waveT <= 0) { spawn(); waveT = .35; }
        }
        for (let i = bugs.length - 1; i >= 0; i--) {
          const b = bugs[i];
          if (!b.on) {   // run-in: immune to wind until planted, so every bug is seen on the field first
            b.u -= 1.6 * dt; b.ph += dt * 3;
            if (b.u <= b.eu) { b.on = true; b.land = .2; burst(ux(b.u), LANES[b.l] + 20, '#c9955a', 6, 140); snd(b.big ? 90 : 160, .08, 'square', .05); }
            continue;
          }
          b.vb *= Math.exp(-6 * dt); b.u += (b.vb - b.walk) * dt; b.ph += dt * (b.vb > b.walk ? 3 : 1);
          if (b.u >= 1) {   // reached the edge: spins away
            bugs.splice(i, 1); const x = ux(b.u), y = LANES[b.l], lastOne = wave === 3 && !bugs.length;
            gone.push({ x, y, vx: 300 + Math.random() * 200, vy: -500 - Math.random() * 200, r: 0, vr: 14, sc: (b.big ? 2.1 : LSC[b.l]), life: 1.4 });
            sfx.boing(); sfx.pop(); burst(x - 40, y, '#fff', 10, 300); if (!lastOne) floatText('BYE!', Math.min(x - 60, W + OX - 100), y - 50, '#fff', 34);
          } else if (b.u <= 0) { lose(b); return; }
        }
      },
      draw(t) {
        bg('#3d7fb8', '#478cc6', t);
        // sun + clouds, then the grass field with three dirt paths
        circ(W / 2 + 200 + OX * .6, 175, 46, '#FFE14D', 5);
        for (const [x, y] of [[90, 170], [520, 200], [-150, 210], [880, 160]]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x + Math.sin(t * .3 + x) * 10, y, 60, 18, 0, 0, 7); ctx.ellipse(x + 26, y - 12, 32, 18, 0, 0, 7); ctx.fill(); }
        ctx.fillStyle = INK; ctx.fillRect(-OX, 244, VW, 360); ctx.fillStyle = '#6dbf5a'; ctx.fillRect(-OX, 250, VW, 360);
        for (let i = 0; i < 3; i++) { ctx.fillStyle = 'rgba(20,16,28,.18)'; ctx.fillRect(cx() + 60, LANES[i] + 6, VW, 30 * LSC[i]); ctx.fillStyle = '#c9955a'; ctx.fillRect(cx() + 60, LANES[i], VW, 26 * LSC[i]); }
        const won = g.result === 'win', lost = g.result === 'lose';
        if (won) txt('BLOWN AWAY!', W / 2, 128 + Math.sin(now * 16) * 3, 48, '#FFE14D');
        else txt(['WAVE 1 / 3', 'WAVE 2 / 3', 'WAVE 3 / 3'][Math.max(0, wave - 1)], W / 2, 106, 30, '#FFE14D');
        const near = bugs.length ? Math.min(...bugs.map(b => b.u)) : 1;
        if (!g.result && clock - waveAt > .8 && (near < .35 || clock > 6.5)) txt('FAN FASTER!', W / 2, 146, 30 + Math.sin(now * 20) * 3, '#FF4D6D');
        // wind streaks
        ctx.lineCap = 'round';
        for (const w of winds) { ctx.strokeStyle = `rgba(255,255,255,${w.a * Math.min(1, w.life * 3)})`; ctx.lineWidth = 6; ctx.beginPath(); for (let j = 0; j <= 8; j++) ctx.lineTo(w.x + w.len * j / 8, w.y + Math.sin(j * .9 + w.x * .02) * 6); ctx.stroke(); }
        ctx.lineCap = 'butt';
        // marching bugs (far lane first); the one that got Claude is drawn on top of him later
        const drawB = (b, x, y, sc, rot) => {
          const back = b.vb > b.walk && b.on, sq = 1 + b.hit * 1.5 - b.land * 1.2;
          shadow(x, y + 30 * sc, 34 * sc, 9 * sc, .25);
          ctx.save(); ctx.translate(x, y); ctx.scale(1 / sq, sq); ctx.translate(-x, -y);
          drawBug(x, y, rot + (back ? .35 : Math.sin(b.ph * 8) * .08), sc, b.ph * (back ? 2.5 : 1));
          if (b.big) {   // steel helmet + angry brows
            ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc); ctx.strokeStyle = INK; ctx.lineWidth = 4;
            ctx.fillStyle = b.hit ? '#fff' : '#a7b3c4'; ctx.beginPath(); ctx.ellipse(0, 4, 23, 26, 0, 0, 7); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#7d8a9c'; ctx.fillRect(-23, 0, 46, 7); ctx.strokeRect(-23, 0, 46, 7);
            for (const [rx, ry] of [[-12, -12], [12, -12], [-14, 16], [14, 16]]) circ(rx, ry, 2.5, '#e8edf3', 1.5);
            ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-9, -42); ctx.lineTo(-2, -37); ctx.moveTo(9, -42); ctx.lineTo(2, -37); ctx.stroke();
            ctx.restore();
          } else if (b.hit) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(x, y, 30 * sc, 22 * sc, 0, 0, 7); ctx.fill(); }
          ctx.restore();
          if (back && b.u < .9) { ctx.fillStyle = '#9fe4ff'; for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + 10 * sc, y - 34 * sc + d * 3, 4, 7, d * .4, 0, 7); ctx.fill(); } }
        };
        for (const b of [...bugs].sort((a, c) => a.l - c.l)) if (b !== biter) drawB(b, ux(b.u), LANES[b.l] - (b.big ? 20 : 4), b.big ? 2.1 : LSC[b.l], -Math.PI / 2);
        for (const o of gone) { ctx.globalAlpha = Math.min(1, o.life * 2); drawBug(o.x, o.y, o.r, o.sc, now * 3); ctx.globalAlpha = 1; }
        // Claude with the giant paper fan
        const X = cx(), Y = 450, U = 8, kq = fanK * .1;
        shadow(X, Y + 4, 80, 14, .3);
        ctx.save(); ctx.translate(X, Y); ctx.scale(1 + kq, 1 - kq); ctx.translate(-X, -Y);
        claude(X, Y, U, { mood: lost ? 'sad' : won ? 'happy' : null, run: g.result ? null : now * .4 });
        ctx.restore();
        const px = X + 7 * U, py = Y - 5.5 * U, A = won ? Math.sin(now * 12) * .6 : lost ? 1.3 : fanA, R = 122 * (1 + fanK * .06);
        ctx.save(); ctx.translate(px, py);
        if (fanK > .3) { ctx.globalAlpha = .25; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, A + fanDir * .5 - 1, A + fanDir * .5 + 1); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
        ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R + 7, A - 1.03, A + 1.03); ctx.closePath(); ctx.fill();
        for (let i = 0; i < 8; i++) { const a = A - 1 + i * .25; ctx.fillStyle = i % 2 ? '#FFF3D6' : '#FF4D6D'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a, a + .25); ctx.closePath(); ctx.fill(); }
        ctx.strokeStyle = INK; ctx.lineWidth = 3; for (let i = 0; i <= 8; i++) { const a = A - 1 + i * .25; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 30, Math.sin(a) * 30); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.stroke(); }
        ctx.restore();
        token(px + Math.cos(A) * R * .62, py + Math.sin(A) * R * .62, 18);
        circ(px, py, 10, '#8a5a2b', 4);
        if (biter) {   // the winner of the race leaps onto Claude and chomps
          const e = Math.min(1, biteT / .2), bx = ux(0) + (X + 34 - ux(0)) * e, by = LANES[biter.l] + (Y - 30 - LANES[biter.l]) * e - Math.sin(e * Math.PI) * 60;
          biter.ph += .05; drawB(biter, bx, by, (biter.big ? 1.6 : 1.05) * (1 + Math.abs(Math.sin(now * 14)) * .08), -Math.PI / 2 - .5);
        }
        vignette(.3);
      },
      probe: () => ({ wave, strokes, clock: +clock.toFixed(2), nextKey: lastKey === 1 ? 'ArrowLeft' : 'ArrowRight', fan: { x: cx() + 56, y: 406 }, contactX: ux(0),
        bugs: bugs.map(b => ({ u: +b.u.toFixed(3), x: Math.round(ux(b.u)), y: LANES[b.l], big: b.big, on: b.on })), nearest: bugs.length ? Math.min(...bugs.map(b => +b.u.toFixed(3))) : null }),
    };
    return g;
  };
})();
