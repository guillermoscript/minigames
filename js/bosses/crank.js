'use strict';
/* ONE STEP AT A TIME (after WarioWare: Twisted!'s staircase boss): every full turn of the crank lifts Claude one step,
   while a hungry frog hops up the stairs behind. Reach the door on step 10 before it catches up.
   Pointer: circle the crank (hover or drag), one way only. Keys: ↑ → ↓ ← in order (or W D S A); a wrong key jams the crank. */
(function () {
  // the chaser: a big hungry frog facing right; air = 0..1 hop height, open = jaw, tongue = 0..1 lash
  function frog(x, y, s, air, open, tongue) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (1 - air * .12), s * (1 + air * .16));
    if (tongue > 0) {
      ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(28, -30); ctx.quadraticCurveTo(28 + tongue * 40, -46 - tongue * 14, 30 + tongue * 78, -40);
      ctx.strokeStyle = INK; ctx.lineWidth = 13; ctx.stroke(); ctx.strokeStyle = '#ff7aa2'; ctx.lineWidth = 7; ctx.stroke(); ctx.lineCap = 'butt';
      circ(30 + tongue * 78, -40, 8, '#ff7aa2', 4);
    }
    ctx.lineWidth = 5; ctx.strokeStyle = INK;
    ctx.fillStyle = '#4e9a3a'; ctx.beginPath(); ctx.ellipse(-26, -4 + air * 6, 22, 9, .2 + air * .5, 0, 7); ctx.fill(); ctx.stroke();   // back foot
    ctx.fillStyle = '#6cc04a'; ctx.beginPath(); ctx.ellipse(0, -30, 40, 28, -.12, 0, 7); ctx.fill(); ctx.stroke();                 // body
    ctx.fillStyle = '#d8f0a8'; ctx.beginPath(); ctx.ellipse(10, -20, 24, 14, -.12, 0, 7); ctx.fill();                               // belly
    circ(-20, -22, 16, '#5cb03e', 5);                                                                                                // haunch
    ctx.fillStyle = '#4e9a3a'; ctx.beginPath(); ctx.ellipse(20, -4 + air * 4, 13, 7, 0, 0, 7); ctx.fill(); ctx.stroke();             // front foot
    for (const ex of [4, 26]) { circ(ex, -58, 13, '#6cc04a', 5); circ(ex + 1, -59, 8, '#fff', 0); circ(ex + 4, -59, 4.5, INK, 0); } // eyes
    ctx.beginPath(); ctx.moveTo(14, -36); ctx.quadraticCurveTo(30, -30 + open * 18, 40, -38); ctx.lineTo(40, -36);
    if (open > .1) { ctx.fillStyle = '#b8203f'; ctx.closePath(); ctx.fill(); }
    ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#ff9aa8'; ctx.beginPath(); ctx.ellipse(24, -42, 5, 3, 0, 0, 7); ctx.fill();                                     // blush
    ctx.restore();
  }

  BOSSES.crank = function (sp, s) {
    const k = Math.min(sp, 1.3) / 1.3, NEED = 10, SW = 80, SR = 30, Q = Math.PI / 2, TAU = Math.PI * 2, CY = 405, CR = 80;
    const KQ = Q * 1.4, MAXR = 2 * TAU, DEAD = 40, BAND = 2.4;                    // a key is worth 1.4 quarter turns; pointer counts ≤ 2 rev/s
    const KEYS = [['ArrowUp', 'KeyW'], ['ArrowRight', 'KeyD'], ['ArrowDown', 'KeyS'], ['ArrowLeft', 'KeyA']];
    let clock = 0, c = 0, cd = 0, b = -3, acc = 0, dir = 0, pend = 0, lastA = null, crankT = -Q, crankA = -Q, notch = 0, idle = 0, sq = 0, kick = 0, f = -1;
    let fall = null, doorT = -1, splat = 0, jam = 0, badKey = -1, lick = 0;
    const CX = () => W + OX - 150;
    const hc = x => Math.max(0, Math.min(NEED, x)) * SR;                       // stair height (px) at step position x
    const sx = x => W / 2 - 40 + (x - f) * SW, sy = h => 455 - (h - hc(f));    // world -> screen (camera on step f)
    const quad = () => ((Math.round(crankT / Q) + 1) % 4 + 4) % 4;             // handle at 0 up, 1 right, 2 down, 3 left
    const nextK = () => (quad() + (dir < 0 ? 3 : 1)) % 4;                      // spinning counter-clockwise reverses the key order
    const frogH = () => { const fl = Math.floor(b), fr = b - fl; return hc(fl) + (hc(fl + 1) - hc(fl)) * Math.min(1, fr * 1.4) + Math.sin(fr * Math.PI) * 30; };

    const climb = () => {
      c++; sq = 1; sfx.blip(c * 2); snd(150 + c * 12, .07, 'triangle', .06);
      burst(sx(c), sy(hc(c)), '#fff', 7, 160);
      if (c === 5) floatText('HALFWAY!', W / 2, 190, '#fff', 40);
      if (c === 8) floatText('ALMOST!', W / 2, 190, '#FFE14D', 40);
      if (c >= NEED) { g.result = 'win'; doorT = 0; sfx.sparkle(); confetti(sx(NEED), sy(hc(NEED)) - 60, 50); ring(sx(NEED), sy(hc(NEED)) - 40, '#FFE14D', 160, .5); }
    };
    const turn = d => {                                                          // net signed crank progress (radians)
      if (g.result || !clock) return;
      acc += d; idle = 0;
      if (!dir && Math.abs(acc) >= TAU) dir = Math.sign(acc);                   // the first full turn locks the direction
      if (dir) acc = dir * Math.max(dir * acc, (c - 2) * TAU);                   // turning back only unwinds (at most two turns of debt)
      const n = Math.floor(acc / (Math.PI / 4)); if (n !== notch) { notch = n; snd(420 + Math.max(0, Math.abs(acc) / TAU - c) * 520, .03, 'square', .03); }
      while (dir && acc * dir >= (c + 1) * TAU && !g.result) climb();
    };
    const lose = () => {
      g.result = 'lose'; b = Math.max(b, cd - .6); lick = 1; fall = { x: cd, h: hc(cd), vx: -3.2, vh: 560, r: 0 };
      sfx.splat(); sfx.buzz(); shake(12, .4); floatText('GOTCHA!', sx(cd), sy(hc(cd)) - 120, '#FF4D6D', 52);
    };

    const g = {
      cmd: 'BOSS!', hint: 'SPIN TO CLIMB (OR ↑→↓←)!', thint: 'DRAW CIRCLES TO CLIMB!', dur: 11, boss: true, wide: true,
      key(e) {
        const i = KEYS.findIndex(q => q.includes(e.code)); if (i < 0 || g.result || jam > 0) return;
        if (i === nextK()) { kick = 1; crankT = (Math.round(crankT / Q) + (dir < 0 ? -1 : 1)) * Q; turn(KQ * (dir || 1)); }
        else { jam = .3; badKey = i; sfx.buzz(); snd(90, .12, 'sawtooth', .05); floatText('JAMMED!', CX(), CY - CR - 70, '#FF4D6D', 30); }  // mashing jams the gears
      },
      move(p) {                                                                  // hover (mouse) or drag (touch) around the crank
        const dx = p.x - CX(), dy = p.y - CY; if (dx * dx + dy * dy < DEAD * DEAD) return;   // wrist jitter near the hub doesn't count
        const a = Math.atan2(dy, dx); if (lastA === null) { lastA = a; return; }
        let d = a - lastA; d -= Math.round(d / TAU) * TAU; lastA = a;
        if (Math.abs(d) < 1 && !g.result) { crankT += d; pend += d; }            // the handle follows the pointer; progress is metered in update
      },
      down(p) { g.move(p); },
      up() { lastA = null; },
      update(dt) {
        clock += dt; idle += dt; sq = Math.max(0, sq - dt * 5); kick = Math.max(0, kick - dt * 6); jam = Math.max(0, jam - dt); lick = Math.max(0, lick - dt * 2.5);
        crankA += (crankT - crankA) * Math.min(1, dt * 28);
        if (pend) { const m = MAXR * dt, u = Math.max(-m, Math.min(m, pend)); pend = Math.max(-.6, Math.min(.6, pend - u)); turn(u); }
        if (cd < c) cd = Math.min(c, cd + dt * 7);
        const gap = c - b, tgt = g.result === 'win' ? NEED - 3.6 : Math.max(cd - Math.min(Math.max(gap, 0), 5) / 2 + .5, cd - 30 / SW);
        f += (tgt - f) * Math.min(1, dt * (g.result === 'win' ? 7 : 4));
        if (g.result === 'lose' && !fall) lose();                                // ran out of time: the frog pounces anyway
        if (fall) { fall.vh -= 1700 * dt; fall.h += fall.vh * dt; fall.x += fall.vx * dt; fall.r -= 10 * dt; b = Math.min(cd, b + dt * 4); }
        if (g.result === 'win') {
          doorT += dt;
          if (doorT > .28 && doorT - dt <= .28) { sfx.thud(); shake(6, .2); burst(sx(NEED + .65), sy(hc(NEED)) - 50, '#c0392b', 10, 220); }
          if (doorT > .3 && !splat) { b = Math.min(NEED + .45, b + dt * 10); if (b >= NEED + .45) { splat = 1; sfx.splat(); shake(10, .3); floatText('SPLAT!', Math.min(sx(NEED + 1.5), W + OX - 100), sy(hc(NEED)) - 40, '#fff', 40); } }
        }
        if (g.result) return;
        b += (.55 + .25 * k + .03 * clock) * dt;                                 // the frog hops steadily, faster over time
        if (c - b > BAND) b += (c - b - BAND) * 3 * dt;                          // ...and never falls far behind
        if (b >= c - .3) lose();
      },
      draw(t) {
        bg('#5fa8e0', '#6cb4e8', t);
        // parallax: far hills sink as we climb, clouds drift
        const par = hc(f) * .35;
        ctx.fillStyle = INK; ctx.fillRect(-OX, 500 + par, VW, 200); ctx.fillStyle = '#7fc46a';
        ctx.beginPath(); ctx.moveTo(-OX, 600); for (let x = -OX; x <= W + OX; x += 40) ctx.lineTo(x, 508 + par + Math.sin(x * .012) * 22); ctx.lineTo(W + OX, 600); ctx.fill();
        for (const [x, y] of [[-120, 180], [180, 250], [520, 160], [880, 220], [1050, 300]]) {
          const cx = ((x - f * 18 + now * 12) % (VW + 300) + VW + 300) % (VW + 300) - OX - 150, cy = y + par * .6;
          ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.ellipse(cx, cy, 58, 17, 0, 0, 7); ctx.ellipse(cx + 24, cy - 12, 30, 16, 0, 0, 7); ctx.fill();
        }
        // ground (step 0 and below) and the staircase columns
        const gy = sy(0); box(-OX - 10, gy, sx(.5) + OX + 10, H - gy + 10, '#8bc66f', 5); ctx.fillStyle = '#6aa954'; ctx.fillRect(-OX, gy + 10, sx(.5) + OX - 3, 6);
        const i0 = Math.max(1, Math.floor(f - (W / 2 + OX) / SW)), i1 = Math.min(NEED, Math.ceil(f + (W / 2 + OX + 80) / SW));
        for (let i = i0; i <= i1; i++) {
          const x = sx(i - .5), y = sy(hc(i)), w = i === NEED ? W + OX - x + 20 : SW;
          box(x, y, w, H - y + 10, i % 2 ? '#d9b07e' : '#cfa271', 5); ctx.fillStyle = '#f0d3a3'; ctx.fillRect(x, y, w, 9);
          ctx.fillStyle = 'rgba(20,16,28,.12)'; for (let yy = y + 30; yy < H; yy += 30) ctx.fillRect(x + (yy / 30 & 1) * SW / 2, yy, 3, 30);
          if (i < NEED) txt(String(i), x + SW / 2, y + 30, 22, INK);
        }
        // the goal door on the top landing, chequered finish-line lintel
        const dx0 = sx(NEED + .25), dy0 = sy(hc(NEED)), DW = 76, DH = 104;
        box3(dx0 - 10, dy0 - DH - 22, DW + 20, DH + 22, '#8a5a2b', 5, 5); box(dx0, dy0 - DH, DW, DH, '#2a1f33', 4);
        box(dx0 - 6, dy0 - DH - 20, DW + 12, 16, '#fff', 3); ctx.fillStyle = INK;
        for (let r = 0; r < 2; r++) for (let q = 0; q < 11; q++) if ((r + q) % 2 === 0) ctx.fillRect(dx0 - 4 + q * 8, dy0 - DH - 18 + r * 6, 8, 6);
        const won = g.result === 'win', lost = g.result === 'lose';
        // Claude: hop from step to step (or walk into the doorway on a win)
        const walk = won ? Math.min(1, doorT / .25) : 0, frc = cd - Math.floor(cd), cx = sx(won ? NEED + walk * .73 : cd);
        const cy = sy(hc(cd) + (cd < c ? Math.sin(frc * Math.PI) * 26 : 0)), U = 6 * (1 - walk * .18);
        if (fall) {
          ctx.save(); ctx.translate(sx(fall.x), sy(fall.h) - 30); ctx.rotate(fall.r); claude(0, 30, 6, { mood: 'sad' }); ctx.restore();
        } else if (!won || doorT < .3) {
          shadow(cx, cy + 2, 40 * (1 - walk * .3), 9, .3);
          const st = sq * .22; ctx.save(); ctx.translate(cx, cy); ctx.scale(1 + st, 1 - st); ctx.translate(-cx, -cy);
          claude(cx, cy, U, { mood: won ? 'happy' : null, run: cd < c || won ? now * .8 : null }); ctx.restore();
          if (!g.result && c - b < 1.4) {                                         // panic sweat + alarm
            ctx.fillStyle = '#9fe4ff'; for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + d * 44, cy - 58 + Math.sin(now * 20 + d) * 4, 5, 8, 0, 0, 7); ctx.fill(); }
            txt('!', cx, cy - 90 + Math.sin(now * 25) * 3, 44, '#FF4D6D');
          }
        }
        // door panel swings shut after Claude walks through; Claude waves from the little window
        if (won && doorT > .25) {
          const cl = Math.min(1, (doorT - .25) / .05), pw = DW * cl;
          box(dx0 + DW - pw, dy0 - DH, pw, DH, '#c0392b', 4);
          if (cl >= 1) {
            circ(dx0 + DW / 2, dy0 - DH + 36, 22, '#9fd8ff', 4); circ(dx0 + DW - 14, dy0 - 52, 6, '#FFE14D', 3);
            ctx.save(); ctx.beginPath(); ctx.arc(dx0 + DW / 2, dy0 - DH + 36, 19, 0, 7); ctx.clip(); claude(dx0 + DW / 2, dy0 - DH + 58, 3.1, { mood: 'happy' }); ctx.restore();
          }
        }
        // the hungry frog: hops a step at a time, tongue flicking when close
        const flat = won && splat, fr = b - Math.floor(b), bx = sx(flat ? NEED + .45 : b), by = sy(flat ? hc(NEED) : frogH());
        if (bx > -OX - 80) {
          const close = !g.result && c - b < 1.6, air = flat ? 0 : Math.sin(fr * Math.PI);
          shadow(bx, sy(hc(Math.round(b))) + 2, 44 * (1 - air * .3), 10, .25);
          ctx.save(); ctx.translate(bx, by); if (flat) ctx.scale(.35, 1.25);
          frog(0, 0, 1.25, air, close || lost ? .6 + Math.sin(now * 18) * .4 : .15, lost ? lick : close ? Math.max(0, Math.sin(now * 7)) * .5 : 0);
          ctx.restore();
        }
        // the crank wheel (jams and rattles red after a wrong key)
        const X = CX(), A = crankA + (jam ? Math.sin(now * 70) * .08 : 0), kk = 1 + kick * .06;
        ctx.save(); ctx.translate(X + (jam ? Math.sin(now * 90) * 4 : 0), CY); ctx.scale(kk, kk);
        shadow(6, CR + 26, CR + 10, 14, .3); circ(0, 0, CR + 22, jam ? '#7a2638' : '#3a3346', 5);
        for (let i = 0; i < 8; i++) circ(Math.cos(i * TAU / 8 + .4) * (CR + 14), Math.sin(i * TAU / 8 + .4) * (CR + 14), 3.5, '#8d84a0', 0);
        circ(0, 0, CR + 8, '#5d6b7d', 5); circ(0, 0, CR - 4, jam ? '#f2b8c0' : '#c7d0db', 4);
        ctx.strokeStyle = INK; ctx.lineWidth = 7; for (let i = 0; i < 6; i++) { const a = A + i * TAU / 6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 16, Math.sin(a) * 16); ctx.lineTo(Math.cos(a) * (CR - 6), Math.sin(a) * (CR - 6)); ctx.stroke(); }
        const pr = acc - (dir || 1) * c * TAU;                                   // progress toward the next step (red = unwinding)
        if (Math.abs(pr) > .02 && !won) { ctx.strokeStyle = dir && pr * dir < 0 ? '#FF4D6D' : '#FFE14D'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(0, 0, CR + 2, -Q, -Q + pr, pr < 0); ctx.stroke(); }
        const hx = Math.cos(A) * (CR - 18), hy = Math.sin(A) * (CR - 18);
        ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 10; ctx.stroke(); ctx.lineCap = 'butt';
        circ(0, 0, 14, '#5d6b7d', 4); circ(hx, hy, 21, '#FF4D6D', 5); circ(hx - 6, hy - 6, 6, '#ffb3c1', 0);
        ctx.restore();
        if (!g.result && idle > .8) {                                             // ghost: a big arrow sweeping round the rim
          const a = now * 5, R = TOUCH ? CR + 36 : CR + 22;
          ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(X, CY, R, a - 2.6, a - .2); ctx.strokeStyle = INK; ctx.lineWidth = 20; ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 11; ctx.stroke(); ctx.lineCap = 'butt';
          ctx.save(); ctx.translate(X + Math.cos(a) * R, CY + Math.sin(a) * R); ctx.rotate(a);
          ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(-22, -6); ctx.lineTo(22, -6); ctx.closePath(); ctx.lineJoin = 'round'; ctx.fillStyle = '#fff'; ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke(); ctx.fill(); ctx.restore();
          txt('SPIN!', X, CY - CR - 64 + Math.sin(now * 10) * 3, 32, '#FFE14D');
        }
        if (!TOUCH) for (let i = 0; i < 4; i++) {                                 // keycaps: next key in the rotation glows, a wrong one flashes red
          const a = -Q + i * Q, kx = X + Math.cos(a) * (CR + 42), ky = CY + Math.sin(a) * (CR + 42), nx = !g.result && !jam && i === nextK(), bad = jam && i === badKey;
          const z = nx ? 1 + Math.sin(now * 14) * .08 : bad ? 1.05 : .85;
          ctx.save(); ctx.translate(kx, ky); ctx.scale(z, z); box(-17, -17, 34, 34, bad ? '#FF4D6D' : nx ? '#FFE14D' : '#e8e2f0', 4); drawArrow(0, 1, i, 10, bad ? '#fff' : nx ? OR : '#9a90a8'); ctx.restore();
        }
        // HUD: step counter, pips with the frog's position, the goal door at the end
        const danger = !g.result && c - b < 1.4, wob = danger ? Math.sin(now * 40) * 3 : 0;
        txt(window.t('STEP {n} / {need}', { n: c, need: NEED }), W / 2 + wob, 100, 30, danger ? '#FF4D6D' : '#FFE14D');
        for (let i = 0; i < NEED; i++) box(W / 2 - 125 + i * 25, 122, 18, 14, i < c ? OR : '#3a3346', 3);
        box(W / 2 + 128, 112, 18, 26, '#c0392b', 3); circ(W / 2 + 142, 126, 2.5, '#FFE14D', 0);
        if (b > -.5 && !won) { const px = W / 2 - 116 + Math.min(b, NEED) * 25; circ(px, 147, 7, '#6cc04a', 3); circ(px + 3, 143, 2, INK, 0); }
        vignette(.3);
      },
      probe: () => ({ step: c, need: NEED, bug: +b.toFixed(2), gap: +(c - b).toFixed(2), turn: +((acc - (dir || 1) * c * TAU) / TAU).toFixed(2), dir, jam: +jam.toFixed(2), tumble: !!fall,
        clock: +clock.toFixed(2), nextKey: KEYS[nextK()][0], crank: { x: CX(), y: CY, r: CR - 18 }, result: g.result || null }),
    };
    return g;
  };
})();
