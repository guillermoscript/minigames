'use strict';
/* Boss games: longer, tougher, end a stage. Each takes (speed, stageDef) and returns a microgame
   object with boss:true (dur is NOT scaled by speed for bosses). */
const BOSSES = {
  /* a giant bug: click it until its health bar is empty */
  bug(sp, s) {
    const max = s.bossHp || 10; let hp = max, flash = 0, hpv = max, sq = 0;
    const b = { x: 400, y: 300, a: Math.random() * 6.28, turn: 0 };
    const g = {
      cmd: 'BOSS!', hint: 'SQUASH THE GIANT BUG', thint: 'TAP THE GIANT BUG', dur: 8, boss: true, wide: true,
      down(p) {
        if (Math.hypot(p.x - b.x, p.y - b.y) < 100) {
          hp--; flash = .12; sq = .2; confetti(p.x, p.y, 6); sfx.hit(); sfx.blip((max - hp) * 1.2); shake(5, .15);
          burst(p.x, p.y, '#FFE14D', 10); ring(p.x, p.y, '#fff', 60, .3); floatText('-1', p.x, p.y - 30, '#fff', 30);
          if (hp <= 0) { g.result = 'win'; confetti(b.x, b.y, 50); sfx.splat(); sfx.sparkle(); shake(14, .4); ring(b.x, b.y, '#FFE14D', 200, .6); burst(b.x, b.y, '#ff4d4d', 24, 380); }
        } else { sfx.miss(); }
      },
      update(dt) {
        flash = Math.max(0, flash - dt); sq = Math.max(0, sq - dt); hpv += (hp - hpv) * Math.min(1, 6 * dt);
        if (g.result) return;
        const v = (130 + (max - hp) * 24) * sp;
        b.turn -= dt; if (b.turn < 0) { b.a += (Math.random() - .5) * 2.6; b.turn = .3 + Math.random() * .5; }
        b.x += Math.cos(b.a) * v * dt; b.y += Math.sin(b.a) * v * dt;
        if (b.x < 130 - OX) { b.x = 130 - OX; b.a = Math.PI - b.a } if (b.x > 670 + OX) { b.x = 670 + OX; b.a = Math.PI - b.a }
        if (b.y < 170) { b.y = 170; b.a = -b.a } if (b.y > 450) { b.y = 450; b.a = -b.a }
      },
      draw(t) {
        bg('#5b1d2b', '#6d2335', t);
        box3(200, 78, 400, 26, '#2b0d14', 5, 4); ctx.fillStyle = '#FFE14D'; ctx.fillRect(200, 78, 400 * hpv / max, 26);
        ctx.fillStyle = flash > 0 ? '#fff' : '#ff4d4d'; ctx.fillRect(200, 78, 400 * hp / max, 26);
        ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(200, 78, 400 * hp / max, 7);
        ctx.fillStyle = INK; for (let i = 1; i < max; i++) ctx.fillRect(200 + 400 * i / max - 1.5, 78, 3, 26);
        txt('MEGA BUG', W / 2, 128, 22);
        if (!g.result) {
          shadow(b.x, b.y + 62, 62 + sq * 60, 18, .3);
          drawBug(b.x, b.y, b.a + Math.PI / 2, 2.6 * (1 + sq * .6), now * 1.5);
          if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(b.x, b.y, 56, 72, b.a + Math.PI / 2, 0, 7); ctx.fill(); }
        } else txt('SPLAT!', W / 2, 300 + Math.sin(now * 20) * 4, 120, '#FFE14D');
        vignette(.3);
      }
    };
    return g;
  },
  /* a shooter: the boss drops bugs, you auto-fire back and slide to dodge */
  shoot(sp, s) {
    const max = s.bossHp || 12; let hp = max, flash = 0, hpv = max, fire = 0, drop = 1;
    const me = { x: W / 2, tx: W / 2 }, bo = { x: W / 2, d: 1 }, shots = [], bombs = [];
    const g = {
      cmd: 'BOSS!', hint: 'SLIDE + AUTO-FIRE!', thint: 'DRAG TO MOVE', dur: 10, boss: true, wide: true,
      move(p) { me.tx = p.x; },
      update(dt) {
        flash = Math.max(0, flash - dt); hpv += (hp - hpv) * Math.min(1, 6 * dt);
        if (g.result) return;
        if (keys.ArrowLeft || keys.KeyA) me.tx -= 700 * dt; if (keys.ArrowRight || keys.KeyD) me.tx += 700 * dt;
        me.tx = Math.max(50 - OX, Math.min(750 + OX, me.tx)); me.x += (me.tx - me.x) * Math.min(1, 16 * dt);
        bo.x += bo.d * (140 + (max - hp) * 12) * sp * dt;
        if (bo.x < 130 - OX) { bo.x = 130 - OX; bo.d = 1; } if (bo.x > 670 + OX) { bo.x = 670 + OX; bo.d = -1; }
        fire -= dt; if (fire < 0) { fire = .26; shots.push({ x: me.x, y: 470 }); sfx.blip(8); }
        drop -= dt; if (drop < 0) { drop = Math.max(.35, .8 - (max - hp) * .03) / sp; bombs.push({ x: bo.x, y: 190, vx: (Math.random() - .5) * 140 }); }
        for (let i = shots.length - 1; i >= 0; i--) {
          const b = shots[i]; b.y -= 620 * dt;
          if (Math.abs(b.x - bo.x) < 70 && b.y < 190 && b.y > 120) {
            shots.splice(i, 1); hp--; flash = .1; sfx.hit(); burst(b.x, 160, '#FFE14D', 6); shake(3, .1);
            if (hp <= 0) { g.result = 'win'; confetti(bo.x, 150, 50); sfx.splat(); sfx.sparkle(); shake(14, .4); ring(bo.x, 150, '#FFE14D', 200, .6); burst(bo.x, 150, '#ff4d4d', 24, 380); return; }
          } else if (b.y < 60) shots.splice(i, 1);
        }
        for (let i = bombs.length - 1; i >= 0; i--) {
          const b = bombs[i]; b.y += (230 + (max - hp) * 8) * sp * dt; b.x += b.vx * dt;
          if (Math.hypot(b.x - me.x, b.y - 485) < 40) { g.result = 'lose'; sfx.thud(); sfx.buzz(); shake(10, .35); confetti(me.x, 485, 20); burst(me.x, 485, '#FF4D4D', 18); ring(me.x, 485, '#fff', 90); return; }
          if (b.y > 560 || b.x < -OX - 40 || b.x > W + OX + 40) bombs.splice(i, 1);
        }
      },
      draw(t) {
        bg('#2b1d4d', '#3a2766', t);
        box3(200, 78, 400, 26, '#2b0d14', 5, 4); ctx.fillStyle = '#FFE14D'; ctx.fillRect(200, 78, 400 * hpv / max, 26);
        ctx.fillStyle = flash > 0 ? '#fff' : '#ff4d4d'; ctx.fillRect(200, 78, 400 * hp / max, 26);
        ctx.fillStyle = INK; for (let i = 1; i < max; i++) ctx.fillRect(200 + 400 * i / max - 1.5, 78, 3, 26);
        txt('BUG QUEEN', W / 2, 128, 22);
        if (g.result !== 'win') { shadow(bo.x, bo.y0 || 250, 50, 12, .3); drawBug(bo.x, 170, Math.PI, 2.4, now * 1.5); if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(bo.x, 170, 56, 72, 0, 0, 7); ctx.fill(); } }
        else txt('SPLAT!', W / 2, 300 + Math.sin(now * 20) * 4, 120, '#FFE14D');
        for (const b of bombs) drawBug(b.x, b.y, Math.PI, .7, now * 2);
        ctx.fillStyle = '#FFE14D'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
        for (const b of shots) { ctx.beginPath(); ctx.roundRect(b.x - 5, b.y - 14, 10, 28, 4); ctx.fill(); ctx.stroke(); }
        shadow(me.x, 525, 24, 7);
        claude(me.x, 500, 3, { mood: g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null, run: g.result ? null : now });
        vignette(.3);
      }
    };
    return g;
  },
  /* mash to fill the meter while it drains */
  mash(sp, s) {
    let v = .3, flash = 0, n = 0;
    const need = 1, drain = .3 + (s.bossMash || 0) * .02;
    const hit = () => {
      if (g.result) return; v = Math.min(need, v + .075); flash = .08; n++; sfx.blip(n % 12); shake(2, .06);
      if (v >= need) { g.result = 'win'; confetti(W / 2, 300, 50); sfx.sparkle(); shake(12, .4); ring(W / 2, 300, '#FFE14D', 220, .6); }
    };
    const g = {
      cmd: 'BOSS!', hint: 'MASH SPACE / CLICK!', thint: 'TAP FAST!', dur: 8, boss: true, wide: true,
      key(e) { if (e.code === 'Space' || e.code === 'Enter') hit(); },
      down() { hit(); },
      update(dt) {
        flash = Math.max(0, flash - dt); if (g.result) return;
        v = Math.max(0, v - (drain + v * .35) * sp * dt);
      },
      draw(t) {
        bg('#14323d', '#1b4452', t);
        const sh = g.result ? 0 : (1 - v) * 4; ctx.save(); ctx.translate((Math.random() - .5) * sh, (Math.random() - .5) * sh);
        txt('OVERLOAD THE SERVER!', W / 2, 110, 30, '#fff');
        box3(120, 260, 560, 60, '#0d1f27', 6, 5); ctx.fillStyle = v > .8 ? '#FFE14D' : v > .4 ? '#7BD88F' : '#ff4d4d'; ctx.fillRect(120, 260, 560 * v, 60);
        ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(120, 260, 560 * v, 16);
        const k = flash > 0 ? 1.15 : 1; ctx.save(); ctx.translate(W / 2, 450); ctx.scale(k, k);
        claude(0, 40, 3.4, { mood: g.result === 'win' ? 'happy' : v < .15 ? 'sad' : null, run: g.result ? null : now });
        ctx.restore(); ctx.restore();
        if (g.result) txt('BOOM!', W / 2, 190, 90, '#FFE14D');
        vignette(.3);
      }
    };
    return g;
  },
  /* tug of war: alternate left / right to drag the boss over the line */
  tug(sp, s) {
    let pos = 0, last = 0, flash = 0; // -1 you win .. +1 boss wins
    const pull = side => {
      if (g.result) return; if (side === last) { pos += .02; sfx.miss(); return; }
      last = side; pos -= .075; flash = .08; sfx.blip(side * 4 + 4); shake(2, .05);
      if (pos <= -1) { g.result = 'win'; confetti(W / 2, 300, 50); sfx.sparkle(); shake(12, .4); }
    };
    const g = {
      cmd: 'BOSS!', hint: 'ALTERNATE A / D!', thint: 'TAP LEFT + RIGHT', dur: 9, boss: true, wide: true,
      key(e) { if (e.code === 'KeyA' || e.code === 'ArrowLeft') pull(-1); else if (e.code === 'KeyD' || e.code === 'ArrowRight') pull(1); },
      down(p) { pull(p.x < W / 2 ? -1 : 1); },
      update(dt) {
        flash = Math.max(0, flash - dt); if (g.result) return;
        pos += (.16 + Math.max(0, pos) * .1) * sp * dt;
        if (pos >= 1) { g.result = 'lose'; sfx.thud(); sfx.buzz(); shake(10, .35); }
      },
      draw(t) {
        bg('#3b2a14', '#4d3819', t);
        txt('TUG OF WAR!', W / 2, 110, 34, '#fff');
        const x = W / 2 + pos * 230;
        ctx.fillStyle = '#fff'; ctx.fillRect(W / 2 - 3, 160, 6, 360);
        ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(120, 400); ctx.lineTo(680, 400); ctx.stroke();
        ctx.strokeStyle = '#d9a35c'; ctx.lineWidth = 6; ctx.stroke();
        ctx.fillStyle = '#ff4d4d'; ctx.fillRect(x - 5, 380, 10, 40);
        shadow(x - 130 + 0, 470, 30, 8); claude(x - 130, 450 + (flash > 0 ? -6 : 0), 3, { mood: g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null, run: g.result ? null : now * 2 });
        shadow(x + 130, 470, 40, 10); drawBug(x + 130, 400, -Math.PI / 2, 2.2, now * 2);
        vignette(.3);
      }
    };
    return g;
  },
  /* rhythm: FINAL BOSS of the cursed disco. Hit Space when the ring closes on the target; 6 of 8 notes win.
     A giant DJ disco ball taunts, sheds tiles and gets more unhinged with every hit; on a win it falls off its pedestal and explodes into sandwiches. */
  rhythm(sp, s) {
    const need = 6, beat = 1.05 / Math.sqrt(sp), notes = []; let hits = 0, miss = 0, flash = 0, fb = '', fbT = 0, slam = '', slamT = 0, slamC = '#FFE14D', winAt = 0, boomed = false, kick = 0;
    for (let i = 0; i < 8; i++) notes.push({ t: 1.2 + i * beat, done: false });
    let clock = 0;
    const tiles = []; for (let i = 0; i < 14; i++) tiles.push({ x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0, c: 0, life: 0 });
    let ti = 0;
    const shed = n => { for (let i = 0; i < n; i++) { const o = tiles[ti++ % tiles.length]; o.x = 400 + (Math.random() - .5) * 90; o.y = 150 + (Math.random() - .3) * 60; o.vx = (Math.random() - .5) * 420; o.vy = -200 - Math.random() * 200; o.r = Math.random() * 6; o.vr = (Math.random() - .5) * 14; o.c = (Math.random() * 3) | 0; o.life = 1.6; } };
    const SLAMS = ['WHAT?!', 'STOP IT!', 'NO WAY!', 'MY TILES!', 'HOW?!'], TAUNT = ['LOL', 'NOPE', 'SKILL ISSUE', 'OOF'];
    const hit = () => {
      if (g.result) return; const n = notes.find(n => !n.done && Math.abs(n.t - clock) < .3);
      if (!n) { miss++; sfx.miss(); fb = 'OOPS'; fbT = .4; return; }
      n.done = true; hits++; const d = Math.abs(n.t - clock); fb = d < .1 ? 'PERFECT!' : 'GOOD'; fbT = .4; flash = .12; kick = .35; sfx.blip(hits * 2); ring(400, 360, '#FFE14D', 100, .3);
      shed(2); sfx.boing(); slam = SLAMS[(hits - 1) % SLAMS.length]; slamT = hits < need ? .5 : 0; slamC = MVC[hits % 6];
      if (hits >= need) { g.result = 'win'; winAt = now; confetti(W / 2, 300, 50); sfx.sparkle(); shake(10, .3); shed(14); }
    };
    const g = {
      cmd: 'BOSS!', hint: 'HIT SPACE ON THE BEAT!', thint: 'TAP ON THE BEAT', dur: 11, boss: true, wide: true,
      key(e) { if (e.code === 'Space' || e.code === 'Enter') hit(); },
      down() { hit(); },
      update(dt) {
        clock += dt; flash = Math.max(0, flash - dt); fbT = Math.max(0, fbT - dt); slamT = Math.max(0, slamT - dt); kick = Math.max(0, kick - dt);
        for (const o of tiles) if (o.life > 0) { o.life -= dt; o.vy += 900 * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.r += o.vr * dt; }
        if (g.result) return;
        for (const n of notes) if (!n.done && clock - n.t > .3) { n.done = true; miss++; sfx.miss(); fb = 'MISS'; fbT = .4; slam = TAUNT[miss % 4]; slamT = .5; slamC = '#FF4D4D'; }
        if (miss > notes.length - need) { g.result = 'lose'; sfx.buzz(); shake(8, .3); }
      },
      draw(t) {
        const k = hits / need, win = g.result === 'win', lose = g.result === 'lose', wt = win ? now - winAt : 0, B = clock / beat;
        mvWarp(.4 + k * 1.6 + (lose ? 1 : 0), now);
        mvPsy(Math.floor(B) % 2 ? '#3a1457' : '#4a1a70', Math.floor(B) % 2 ? '#6a1f9a' : '#7d2ab0', now, .5 + k * 1.1);
        mvTiles(470, now, 100 + k * 80);
        mvAudience(468, now, .6 + k * 1.4 + (win ? 1 : 0) + (lose ? -.5 : 0), .85, Math.sin(now * 2), -.3);
        /* the boss: giant DJ disco ball on a pedestal */
        let bx = 400 + Math.sin(now * (2 + k * 4)) * (6 + k * 26), by = 150 + Math.sin(now * 3) * 6 - kick * 40, br = 70 * (1 + Math.max(0, Math.sin(B * Math.PI * 2)) * .05 + kick * .4);
        if (win) { const f = Math.min(wt, 1); by = 150 + 900 * f * f * .33 + 320 * f; bx += wt * 60; }
        const alive = !win || by < 440;
        if (!win) { ctx.fillStyle = INK; ctx.fillRect(bx - 34, 232, 68, 240); ctx.fillStyle = '#8a6ad8'; ctx.fillRect(bx - 28, 236, 56, 236); }
        if (alive) {
          ctx.save(); ctx.translate(bx, by); ctx.rotate((win ? wt * 12 : Math.sin(now * (3 + k * 5)) * .12 * (1 + k * 2))); ctx.translate(-bx, -by);
          mvBall(bx, by, br, now * (1 + k * 3));
          const ex = Math.sin(now * (3 + k * 6)) * (k > .5 ? 1 : .3), ey = .8 + Math.cos(now * 4) * (k > .5 ? 1 : 0);
          mvEye(bx - br * .32, by + br * .05, br * .26, ex, ey); mvEye(bx + br * .32, by + br * .05, br * .26, -ex, ey);
          if (k > .6) { const sw = Math.sin(now * 30) * br * .1; ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(bx - br * .32 + sw, by + br * .05, br * .09, 0, 7); ctx.arc(bx + br * .32 - sw, by + br * .05, br * .09, 0, 7); ctx.fill(); }
          ctx.fillStyle = INK; ctx.beginPath(); const mo = lose ? br * .3 : (win ? br * .35 : Math.max(0, Math.sin(B * Math.PI * 2 + 1)) * br * .22 * (1 + k));
          ctx.ellipse(bx, by + br * .55, br * .22, br * .05 + mo, 0, 0, 7); ctx.fill();
          if (mo > br * .08) { ctx.fillStyle = '#FF3EA5'; ctx.fillRect(bx - br * .1, by + br * .55 + mo * .3, br * .2, mo * .6); }
          ctx.restore();
          /* DJ hot dog riding on top, headphones on */
          if (!win) { mvFoodie(bx, by - br + 14, .55, 0, now, 1 + k * 2); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(bx, by - br - 22, 15, Math.PI, 0); ctx.stroke(); circ(bx - 15, by - br - 20, 6, '#FF3EA5', 3); circ(bx + 15, by - br - 20, 6, '#FF3EA5', 3); }
        } else if (!boomed) {
          boomed = true; sfx.splat(); sfx.boing(); shake(14, .5); confetti(bx, 440, 60); burst(bx, 440, '#F0B35A', 24, 420); ring(bx, 440, '#fff', 200, .5);
        }
        /* flying mirror tiles */
        for (const o of tiles) if (o.life > 0) { ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.r); ctx.fillStyle = o.c ? '#fff' : '#9fb0d6'; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.fillRect(-8, -8, 16, 16); ctx.strokeRect(-8, -8, 16, 16); ctx.restore(); }
        /* explosion of sandwiches */
        if (win && boomed) { const e = wt - .75; if (e > 0) for (let i = 0; i < 6; i++) { const a = -1.2 - i * .5, v = 380 + i * 60, sx = bx + Math.cos(a) * v * e * (i & 1 ? -1 : 1), sy = 440 + Math.sin(a) * v * e + 700 * e * e;
          ctx.save(); ctx.translate(sx, sy); ctx.rotate(e * (4 + i)); ctx.fillStyle = INK; ctx.fillRect(-27, -19, 54, 38); ctx.fillStyle = '#F0B35A'; ctx.fillRect(-23, -15, 46, 10); ctx.fillRect(-23, 5, 46, 10); ctx.fillStyle = '#5CFF7A'; ctx.fillRect(-25, -5, 50, 5); ctx.fillStyle = '#FF8FD0'; ctx.fillRect(-21, 0, 42, 5); ctx.restore(); } }
        txt('DANCE-OFF!', W / 2, 40, 28, '#fff'); txt(`${hits} / ${need}`, W / 2, 262, 26, '#FFE14D');
        ctx.lineWidth = 8; ctx.strokeStyle = flash > 0 ? '#fff' : '#FFE14D'; ctx.beginPath(); ctx.arc(400, 360, 60, 0, 7); ctx.stroke();
        for (const n of notes) { const d = n.t - clock; if (n.done || d > .9 || d < -.3) continue; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(400, 360, 60 + Math.max(0, d) * 220, 0, 7); ctx.stroke(); }
        claude(400, 380 + Math.sin(clock * Math.PI / beat * 2) * 8, 3, { mood: lose ? 'sad' : win ? 'happy' : null, run: g.result ? null : now });
        if (fbT > 0) txt(fb, 400, 300, 40, '#fff');
        if (win && wt > .9) mvSlam('SANDWICHES?!', Math.max(.3, 1 - (wt - .9) * 1.5), '#5CFF7A', 330, 80); else mvSlam(slam, slamT * 2, slamC, 330, 90);
        ctx.restore();
        vignette(.3);
      }
    };
    return g;
  },
  /* catch falling coins in a basket, dodge the bombs */
  catch(sp, s) {
    const need = 10; let got = 0, spawn = .3; const me = { x: W / 2, tx: W / 2 }, it = [];
    const g = {
      cmd: 'BOSS!', hint: 'CATCH COINS, AVOID BOMBS!', thint: 'DRAG TO MOVE', dur: 11, boss: true, wide: true,
      move(p) { me.tx = p.x; },
      update(dt) {
        if (g.result) return;
        if (keys.ArrowLeft || keys.KeyA) me.tx -= 700 * dt; if (keys.ArrowRight || keys.KeyD) me.tx += 700 * dt;
        me.tx = Math.max(60 - OX, Math.min(740 + OX, me.tx)); me.x += (me.tx - me.x) * Math.min(1, 16 * dt);
        spawn -= dt; if (spawn < 0) { spawn = .5 / sp / Math.sqrt(VW / W); it.push({ x: 60 - OX + Math.random() * (680 + 2 * OX), y: 60, bomb: Math.random() < .3 }); }
        for (let i = it.length - 1; i >= 0; i--) {
          const o = it[i]; o.y += 280 * sp * dt;
          if (Math.abs(o.x - me.x) < 55 && Math.abs(o.y - 490) < 28) {
            it.splice(i, 1);
            if (o.bomb) { g.result = 'lose'; sfx.thud(); sfx.buzz(); shake(10, .35); burst(me.x, 490, '#FF4D4D', 18); ring(me.x, 490, '#fff', 90); return; }
            got++; sfx.blip(got); floatText('+1', me.x, 450, '#FFE14D', 28);
            if (got >= need) { g.result = 'win'; confetti(W / 2, 300, 50); sfx.sparkle(); shake(10, .3); return; }
          } else if (o.y > 570) it.splice(i, 1);
        }
      },
      draw(t) {
        bg('#14394d', '#1b4a63', t);
        txt(window.t('COINS {got} / {need}', { got, need }), W / 2, 100, 32, '#FFE14D');
        for (const o of it) {
          if (o.bomb) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(o.x, o.y, 22, 0, 7); ctx.fill(); ctx.fillStyle = '#ff4d4d'; ctx.fillRect(o.x - 3, o.y - 34, 6, 12); }
          else { ctx.fillStyle = '#FFE14D'; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(o.x, o.y, 20, 0, 7); ctx.fill(); ctx.stroke(); }
        }
        shadow(me.x, 540, 40, 8); claude(me.x, 515, 3, { mood: g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null, run: g.result ? null : now });
        ctx.fillStyle = '#d9a35c'; ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.fillRect(me.x - 50, 470, 100, 22); ctx.strokeRect(me.x - 50, 470, 100, 22);
        vignette(.3);
      }
    };
    return g;
  },
  /* slash: click / swipe the bugs flying up, don't touch the bombs */
  slash(sp, s) {
    const need = 12; let got = 0, spawn = .4, sx = -1, sy = -1; const it = [];
    const cut = p => {
      if (g.result) return;
      for (let i = it.length - 1; i >= 0; i--) {
        const o = it[i];
        if (Math.hypot(p.x - o.x, p.y - o.y) < 46) {
          it.splice(i, 1);
          if (o.bomb) { g.result = 'lose'; sfx.thud(); sfx.buzz(); shake(10, .35); burst(o.x, o.y, '#FF4D4D', 18); ring(o.x, o.y, '#fff', 90); return; }
          got++; sfx.hit(); burst(o.x, o.y, '#FFE14D', 8); floatText('+1', o.x, o.y - 20, '#fff', 28);
          if (got >= need) { g.result = 'win'; confetti(W / 2, 300, 50); sfx.sparkle(); shake(10, .3); return; }
        }
      }
    };
    const g = {
      cmd: 'BOSS!', hint: 'SLASH BUGS, SKIP BOMBS!', thint: 'SWIPE THE BUGS', dur: 10, boss: true, wide: true,
      move(p) { if (pressing) cut(p); }, down(p) { cut(p); },
      update(dt) {
        if (g.result) return;
        spawn -= dt; if (spawn < 0) { spawn = .5 / sp / Math.sqrt(VW / W); const x = 80 - OX + Math.random() * (640 + 2 * OX); it.push({ x, y: 560, vx: (W / 2 - x) * .25 + (Math.random() - .5) * 80, vy: -(520 + Math.random() * 120) * Math.sqrt(sp), bomb: Math.random() < .25 }); }
        for (let i = it.length - 1; i >= 0; i--) { const o = it[i]; o.vy += 700 * dt; o.x += o.vx * dt; o.y += o.vy * dt; if (o.y > 600 && o.vy > 0) it.splice(i, 1); }
      },
      draw(t) {
        bg('#2d4d14', '#3a6319', t);
        txt(window.t('BUGS {got} / {need}', { got, need }), W / 2, 100, 32, '#FFE14D');
        for (const o of it) { if (o.bomb) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(o.x, o.y, 28, 0, 7); ctx.fill(); ctx.fillStyle = '#ff4d4d'; ctx.fillRect(o.x - 3, o.y - 42, 6, 14); } else drawBug(o.x, o.y, o.vx * .003, 1, now * 2); }
        vignette(.3);
      }
    };
    return g;
  },
  /* runner: jump over the barriers rushing at you — survive the timer or clear the goal */
  stomp(sp, s) {
    const k = Math.min(sp, 1.15), me = { y: 0, vy: 0 }, ob = []; let spawn = 1, dist = 0, buf = 0; const goal = 8;
    const jump = () => { if (g.result) return; if (me.y === 0) { me.vy = 900; sfx.blip(6); } else buf = .18; };
    const g = {
      cmd: 'BOSS!', hint: 'SPACE TO JUMP!', thint: 'TAP TO JUMP', dur: 10, boss: true, wide: true, timeWin: true,
      key(e) { if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') jump(); }, down() { jump(); },
      update(dt) {
        if (g.result) return;
        buf = Math.max(0, buf - dt);
        me.vy -= 2300 * dt; me.y = Math.max(0, me.y + me.vy * dt); if (me.y === 0) { me.vy = 0; if (buf > 0) { buf = 0; me.vy = 900; sfx.blip(6); } }
        spawn -= dt; if (spawn < 0) { spawn = (1.1 + Math.random() * .5) / k; ob.push({ x: W + OX + 60, w: 30 + Math.random() * 14, h: 38 + Math.random() * 18 }); }
        for (let i = ob.length - 1; i >= 0; i--) {
          const o = ob[i]; o.x -= 380 * k * dt;
          if (o.x < 160 + 14 && o.x + o.w > 160 - 14 && me.y < o.h - 14) { g.result = 'lose'; sfx.thud(); sfx.buzz(); shake(10, .35); burst(160, 440 - me.y, '#FF4D4D', 18); return; }
          if (o.x + o.w < -OX - 20) { ob.splice(i, 1); continue; }
          if (!o.done && o.x + o.w < 100) { o.done = true; dist++; sfx.blip(dist); if (dist >= goal) { g.result = 'win'; confetti(W / 2, 300, 50); sfx.sparkle(); shake(10, .3); return; } }
        }
      },
      draw(t) {
        bg('#4d3a14', '#634a19', t);
        txt(window.t('BARRIERS {dist} / {goal}', { dist, goal }), W / 2, 100, 30, '#FFE14D');
        ctx.fillStyle = INK; ctx.fillRect(-OX, 450, VW, 150); ctx.fillStyle = '#7d5a22'; ctx.fillRect(-OX, 456, VW, 144);
        for (const o of ob) { ctx.fillStyle = '#ff4d4d'; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.fillRect(o.x, 450 - o.h, o.w, o.h); ctx.strokeRect(o.x, 450 - o.h, o.w, o.h); }
        shadow(160, 456, 28 - me.y / 20, 7); claude(160, 440 - me.y, 2.8, { mood: g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null, run: g.result || me.y > 0 ? null : now * 2 });
        vignette(.3);
      }
    };
    return g;
  },
  /* whack the boss moles popping out of a 3x3 grid */
  mole(sp, s) {
    const need = 12; let got = 0, esc = 0, spawn = .4; const ms = [];
    const cell = i => ({ x: 210 + (i % 3) * 190, y: 230 + (i / 3 | 0) * 120 });
    const g = {
      cmd: 'BOSS!', hint: 'WHACK THE MOLES!', thint: 'TAP THE MOLES', dur: 10, boss: true, wide: true,
      down(p) {
        if (g.result) return;
        for (const m of ms) { const c = cell(m.i); if (!m.hit && Math.hypot(p.x - c.x, p.y - c.y) < 62) {
          m.hit = true; m.t = .15; got++; sfx.hit(); burst(c.x, c.y, '#FFE14D', 8); floatText('+1', c.x, c.y - 40, '#fff', 28); shake(3, .1);
          if (got >= need) { g.result = 'win'; confetti(W / 2, 300, 50); sfx.sparkle(); shake(10, .3); } return; } }
        sfx.miss();
      },
      update(dt) {
        if (g.result) return;
        spawn -= dt; if (spawn < 0) { spawn = .42 / sp; const free = [...Array(9).keys()].filter(i => !ms.some(m => m.i === i)); if (free.length) ms.push({ i: free[Math.random() * free.length | 0], t: .9 / Math.sqrt(sp), hit: false }); }
        for (let i = ms.length - 1; i >= 0; i--) { const m = ms[i]; m.t -= dt; if (m.t <= 0) { if (!m.hit) { esc++; sfx.miss(); if (esc >= 4) { g.result = 'lose'; sfx.buzz(); shake(8, .3); } } ms.splice(i, 1); } }
      },
      draw(t) {
        bg('#3d2a14', '#4d3a1c', t);
        txt(window.t('MOLES {got} / {need}', { got, need }), W / 2, 100, 30, '#FFE14D'); txt(window.t('ESCAPED {esc} / 4', { esc }), W / 2, 140, 20, '#ff9a9a');
        for (let i = 0; i < 9; i++) { const c = cell(i); ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(c.x, c.y + 28, 62, 20, 0, 0, 7); ctx.fill(); }
        for (const m of ms) { const c = cell(m.i); drawBug(c.x, c.y - (m.hit ? 0 : 6), 0, m.hit ? 1.2 : 1.5, now * 2); }
        vignette(.3);
      }
    };
    return g;
  },
  /* memory: watch the arrows, then repeat them */
  simon(sp, s) {
    const len = 4, seq = Array.from({ length: len }, () => Math.random() * 4 | 0), cols = ['#ff4d4d', '#4dff88', '#4da6ff', '#FFE14D'], names = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'], alt = ['KeyW', 'KeyD', 'KeyS', 'KeyA'];
    let ph = 'show', clock = 0, idx = 0, lit = -1, litT = 0; const step = .65 / Math.sqrt(sp);
    const press = d => {
      if (g.result || ph !== 'input') return; lit = d; litT = .2;
      if (d !== seq[idx]) { g.result = 'lose'; sfx.buzz(); shake(8, .3); return; }
      sfx.blip(d * 3 + 2); if (++idx >= len) { g.result = 'win'; confetti(W / 2, 300, 50); sfx.sparkle(); shake(10, .3); }
    };
    const g = {
      cmd: 'BOSS!', hint: 'REMEMBER, THEN REPEAT!', thint: 'TAP THE PADS', dur: 11, boss: true, wide: true,
      key(e) { let d = names.indexOf(e.code); if (d < 0) d = alt.indexOf(e.code); if (d >= 0) press(d); },
      down(p) { const dx = p.x - W / 2, dy = p.y - 330; if (Math.hypot(dx, dy) < 40) return; press(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0)); },
      update(dt) {
        litT = Math.max(0, litT - dt); if (g.result) return; clock += dt;
        if (ph === 'show') { const k = Math.floor((clock - .8) / step); if (clock < .8) lit = -1; else if (k < len) { const fr = (clock - .8) / step - k; if (fr < .1 && lit !== seq[k]) sfx.blip(seq[k] * 3 + 2); lit = fr < .7 ? seq[k] : -1; litT = .01; } else { ph = 'input'; lit = -1; } }
      },
      draw(t) {
        bg('#1d1a4d', '#262266', t);
        txt(ph === 'show' ? 'WATCH...' : 'YOUR TURN!', W / 2, 110, 36, '#fff');
        const pos = [[0, -110], [110, 0], [0, 110], [-110, 0]];
        pos.forEach(([dx, dy], i) => { const on = litT > 0 && lit === i; ctx.fillStyle = on ? '#fff' : cols[i]; ctx.globalAlpha = on ? 1 : .55; ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(W / 2 + dx - 50, 330 + dy - 50, 100, 100, 18); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1; });
        for (let i = 0; i < len; i++) { ctx.fillStyle = i < idx ? '#FFE14D' : '#fff3'; ctx.beginPath(); ctx.arc(W / 2 - 45 + i * 30, 500, 9, 0, 7); ctx.fill(); }
        vignette(.3);
      }
    };
    return g;
  },
  /* power meter: stop the sliding marker inside the shrinking green zone, three times */
  power(sp, s) {
    let x = 0, d = 1, round = 0, zone = .22; let zc = .3 + Math.random() * .4, fb = '', fbT = 0, pause = 0;
    const stop = () => {
      if (g.result || pause > 0) return;
      if (Math.abs(x - zc) < zone / 2) {
        round++; sfx.blip(round * 4); confetti(W / 2, 330, 14); fb = 'NICE!'; fbT = .6;
        if (round >= 3) { g.result = 'win'; sfx.sparkle(); shake(10, .3); confetti(W / 2, 300, 40); return; }
        zone *= .7; zc = .15 + Math.random() * .7; pause = .35;
      } else { g.result = 'lose'; sfx.buzz(); shake(8, .3); fb = 'MISSED'; fbT = 1; }
    };
    const g = {
      cmd: 'BOSS!', hint: 'STOP IT IN THE GREEN (x3)!', thint: 'TAP TO STOP', dur: 9, boss: true, wide: true,
      key(e) { if (e.code === 'Space' || e.code === 'Enter') stop(); }, down() { stop(); },
      update(dt) {
        fbT = Math.max(0, fbT - dt); if (g.result) return; if (pause > 0) { pause -= dt; return; }
        x += d * (.9 + round * .45) * sp * dt; if (x > 1) { x = 1; d = -1; } if (x < 0) { x = 0; d = 1; }
      },
      draw(t) {
        bg('#14324d', '#1b4263', t);
        txt(window.t('ROUND {r} / 3', { r: Math.min(3, round + 1) }), W / 2, 110, 34, '#fff');
        box3(100, 280, 600, 60, '#0d1f27', 6, 5); ctx.fillStyle = '#4dff88'; ctx.fillRect(100 + 600 * (zc - zone / 2), 280, 600 * zone, 60);
        ctx.fillStyle = INK; ctx.fillRect(100 + 600 * x - 7, 262, 14, 96); ctx.fillStyle = '#fff'; ctx.fillRect(100 + 600 * x - 4, 266, 8, 88);
        claude(W / 2, 500, 3, { mood: g.result === 'lose' ? 'sad' : g.result === 'win' ? 'happy' : null, run: null });
        if (fbT > 0) txt(fb, W / 2, 210, 50, '#FFE14D');
        vignette(.3);
      }
    };
    return g;
  },
  /* a long word to type */
  type(sp, s) {
    const g = gType(sp, s.bossWord || 'REFACTOR');
    g.cmd = 'BOSS!'; g.hint = 'TYPE THE WORD!'; g.thint = 'TAP THE LETTERS'; g.dur = 9; g.boss = true;
    const d = g.draw; g.draw = t => { d(t); vignette(.3); };
    return g;
  },
  /* a bigger swarm of bouncing bugs */
  dodge(sp, s) {
    const g = gDodge(sp + .2, s.bossBalls || 3);
    g.cmd = 'BOSS!'; g.hint = 'SURVIVE THE SWARM!'; g.thint = 'DRAG TO DODGE'; g.dur = 9; g.boss = true;
    const d = g.draw; g.draw = t => { d(t); vignette(.3); };
    return g;
  }
};
