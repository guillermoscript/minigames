'use strict';
/* CONDUCT: WII WAGGLE boss, after Smooth Moves' "Opening Night". Wave the baton through the 4/4 pattern
   (1 DOWN, 2 LEFT, 3 RIGHT, 4 UP) on the beat: each hit plays the next note of Ode to Joy.
   A pink beat ball travels the pattern and lands on each mark on its beat (120 bpm, in step with the fuse tick).
   One bar of count-in, then 16 beats: 12 notes win, a 5th sour note loses.
   Pointer: the baton tip follows the mouse / finger; a beat counts when the baton ENTERS the lit mark on time.
     Entering one of the two other marks while a beat is due, or the lit mark too early, is a sour note.
   Keyboard: the matching arrow (or WASD) on the beat; a press of the next arrow too early is a sour note,
     a late press of the previous arrow is forgiven (it does not spend the next beat). */
(() => {
  const NEED = 12, MAXMISS = 4, ZONE = 70, WZ = 52, R = 44, CX = 400, CF = 386, U = 6;
  const BEAT = .5, LEAD = 1, WIN = .2, PEARLY = .26;   // beats land on the fuse ticks; pointer may enter a bit earlier
  const MARKS = [   // dir for drawArrow: 0 up, 1 right, 2 down, 3 left; f = float-text offset
    { x: 400, y: 470, dir: 2, codes: ['ArrowDown', 'KeyS'], f: 66 },
    { x: 205, y: 335, dir: 3, codes: ['ArrowLeft', 'KeyA'], f: -62 },
    { x: 595, y: 335, dir: 1, codes: ['ArrowRight', 'KeyD'], f: -62 },
    { x: 400, y: 205, dir: 0, codes: ['ArrowUp', 'KeyW'], f: 70 }];
  const CTRL = [[400, 340], [250, 470], [400, 425], [585, 215]];   // curve control INTO each mark from the previous one
  const MEL = [76, 76, 77, 79, 79, 77, 76, 74, 72, 72, 74, 76, 74, 72, 72, 72];   // Ode to Joy
  const BASS = [48, 48, 48, 48, 43, 43, 43, 43, 48, 48, 48, 48, 43, 43, 48, 48];
  const CHORD = [[60, 64, 67], [55, 59, 62], [60, 64, 67], [55, 59, 62]];
  const MUS = [{ k: 'drum', x: 92 }, { k: 'violin', col: '#4DB8FF', x: 222 }, { k: 'trumpet', col: '#5CFF7A', x: 578 }, { k: 'tuba', col: '#FF7AC8', x: 708 },
    { k: 'cello', col: '#B48CFF', side: -1 }, { k: 'cymbal', side: 1 }];
  const bez = (k, u) => { const A = MARKS[(k + 3) % 4], B = MARKS[k], C = CTRL[k], v = 1 - u;
    return { x: v * v * A.x + 2 * v * u * C[0] + u * u * B.x, y: v * v * A.y + 2 * v * u * C[1] + u * u * B.y }; };

  BOSSES.conduct = function (sp, s) {
    if (typeof mus !== 'undefined' && mus.on) stopMusic();   // the orchestra IS the music: hush the boss track before the card
    const beat = BEAT, lead = LEAD;
    const beats = Array.from({ length: 20 }, (_, i) => ({ t: lead + i * beat, k: i % 4, sc: i >= 4, j: i - 4, done: false }));
    let clock = 0, hits = 0, misses = 0, ticked = 0, count = 0, countT = 0, kick = 0, sad = 0, side = 1, endT = 0, land = 0;
    const hist = [], aim = { x: 462, y: 285 }, ptr = { x: 462, y: 285 }, tip = { x: 462, y: 285 }, trail = [], fl = MARKS.map(() => ({ f: 0, bad: 0 })), notes = [];
    let was = MARKS.map(() => [false, false]);   // pointer inside [ZONE, WZ] of each mark last frame
    MUS.forEach(m => { m.bob = 0; m.sad = 0; });
    const mx = m => m.side ? (m.side < 0 ? -OX / 2 - 25 : W + OX / 2 + 25) : m.x;
    const say = (s, k, c, sz = 26) => floatText(s, MARKS[k].x, MARKS[k].y + MARKS[k].f, c, sz);
    const play = j => {
      const f = midi(MEL[j]);
      snd(f, beat * .95, 'triangle', .1); snd(f, beat * .55, 'square', .022); snd(f * 2, beat * .4, 'sine', .02);
      if (j % 4 === 0) { CHORD[j / 4].forEach(n => snd(midi(n), beat * 3.6, 'triangle', .035)); snd(98, .3, 'sine', .14, 0, 55); }
    };
    const hit = b => {
      b.done = 'hit'; hits++; const M = MARKS[b.k], d = Math.abs(clock - b.t); hist.push(['hit', b.j, +(clock - b.t).toFixed(3)]);
      play(b.j); fl[b.k].f = .25; kick = .3; sad = 0;
      burst(M.x, M.y, '#FFE14D', 10); ring(M.x, M.y, '#fff', 80, .3);
      if (d < .09) say('BRAVO!', b.k, '#FFE14D');
      MUS.forEach(m => { m.bob = 1; m.sad = 0; });
      const m = MUS[hits % 4]; notes.push({ x: m.x + 20, y: 470, vx: (Math.random() - .5) * 60, life: 1.1, c: ['#FFE14D', '#5CFF7A', '#4DB8FF', '#FF7AC8'][hits % 4] });
      if (hits >= NEED) {
        g.result = 'win'; endT = 0; [60, 64, 67, 72].forEach(n => snd(midi(n), 1.3, 'triangle', .05, beat)); snd(98, .5, 'sine', .16, beat, 50); sfx.sparkle();
        confetti(CX, 300, 60); shake(10, .3); ring(CX, 330, '#FFE14D', 240, .6); MUS.forEach(m => { m.bob = 1; });
      }
    };
    const miss = (b, why) => {
      b.done = 'miss'; misses++; const f = midi(MEL[b.j]); hist.push([why || 'sour', b.j, +(clock - b.t).toFixed(3)]);
      sfx.buzz(); snd(f * 1.07, .3, 'sawtooth', .035); snd(f * .93, .3, 'sawtooth', .035);
      fl[b.k].bad = .35; sad = .5; shake(5, .15); say(why || 'SOUR!', b.k, '#FF4D4D', why ? 24 : 28);
      MUS[misses % 4].sad = 1; MUS[(misses + 2) % 6].sad = 1;
      if (misses > MAXMISS) { g.result = 'lose'; endT = 0; MUS.forEach(m => { m.sad = 9; }); sfx.thud(); shake(10, .35); burst(CX, 340, '#FF4D4D', 20); }
    };
    const pend = () => beats.find(b => b.sc && !b.done);   // the beat being asked for (marks are always in 4/4 order)
    const lit = b => b && !g.result && clock >= b.t - WIN;
    const forgive = (b, k) => { const p = beats[b.j + 3]; if (p.done === 'miss' && p.sc && !p.late) { p.late = 1; say('TOO LATE!', k, '#FF9D4D', 22); } sfx.tick(); };
    const g = {
      cmd: 'BOSS!', hint: 'CONDUCT: MOUSE OR ARROWS!', thint: 'CONDUCT: DRAG TO THE BEAT!', dur: +(lead + 19 * beat + .8).toFixed(1), boss: true, wide: true,
      move(p) { aim.x = ptr.x = p.x; aim.y = ptr.y = p.y; },
      key(e) {
        const k = MARKS.findIndex(M => M.codes.includes(e.code)); if (k < 0 || g.result) return;
        aim.x = MARKS[k].x; aim.y = MARKS[k].y;
        const b = pend(); if (!b) return;
        const d = clock - b.t, prev = (b.k + 3) % 4;
        if (k === prev && d < 0) return forgive(b, k);          // late press for the beat that just went by
        if (Math.abs(d) <= WIN) return k === b.k ? hit(b) : miss(b);
        if (k === b.k && d >= -beat) return miss(b, 'TOO EARLY!');   // jumping the gun (or mashing)
        sfx.tick();
      },
      update(dt) {
        if (typeof mus !== 'undefined' && mus.on) stopMusic();   // e.g. un-muting mid-boss
        kick = Math.max(0, kick - dt); sad = Math.max(0, sad - dt); countT += dt; endT += dt; land = Math.max(0, land - dt);
        fl.forEach(o => { o.f = Math.max(0, o.f - dt); o.bad = Math.max(0, o.bad - dt); });
        MUS.forEach(m => { m.bob = Math.max(0, m.bob - dt * 3); m.sad = Math.max(0, m.sad - dt); });
        for (let i = notes.length - 1; i >= 0; i--) { const n = notes[i]; n.life -= dt; n.x += n.vx * dt; n.y -= 90 * dt; if (n.life <= 0) notes.splice(i, 1); }
        tip.x += (aim.x - tip.x) * Math.min(1, 22 * dt); tip.y += (aim.y - tip.y) * Math.min(1, 22 * dt);
        trail.unshift({ x: tip.x, y: tip.y }); if (trail.length > 9) trail.pop();
        side = tip.x < CX - 30 ? -1 : tip.x > CX + 30 ? 1 : side;
        if (g.result) return;
        clock += dt;
        while (ticked < beats.length && clock >= beats[ticked].t) {   // count-in woodblock, then a pizzicato bass pulse on every beat
          const b = beats[ticked++]; land = .18;
          if (!b.sc) { count = ticked; countT = 0; snd(b.k ? 1250 : 1650, .06, 'sine', .11, 0, b.k ? 900 : 1200); noise(.025, .07, 2600, 2600, 'bandpass', 0, 4); fl[b.k].f = .15; }
          else snd(midi(BASS[b.j]), .22, 'triangle', .13);
        }
        // pointer: entries into the mark zones this frame
        const ins = MARKS.map(M => { const d = Math.hypot(ptr.x - M.x, ptr.y - M.y); return [d < ZONE, d < WZ]; });
        const ent = ins.map((v, k) => [v[0] && !was[k][0], v[1] && !was[k][1]]); was = ins;
        let b = pend();
        if (b) {
          const d = clock - b.t, prev = (b.k + 3) % 4;
          if (!b.open && d >= -PEARLY) { b.open = 1; if (ins[b.k][0]) ent[b.k][0] = true; }   // already waiting on the mark (from the count-in) counts
          if (ent[b.k][0]) { if (d >= -PEARLY && d <= WIN) hit(b); else if (d >= -beat && d < -PEARLY) miss(b, 'TOO EARLY!'); }
          else if (d >= -PEARLY && d <= WIN && MARKS.some((M, k) => k !== b.k && k !== prev && ent[k][1])) miss(b);
          if (g.result) return;
        }
        while ((b = pend()) && clock - b.t > WIN) { miss(b); if (g.result) return; }
      },
      draw(t) {
        X = ctx;
        const win = g.result === 'win', lose = g.result === 'lose', P = pend(), nx = beats.find(b => clock < b.t) || beats[19], act = g.result ? null : P && P.t <= nx.t ? P : nx;
        if (!BG || BGox !== OX) { BG = buildBg(); BGox = OX; }
        ctx.drawImage(BG, -OX, 0);
        const pulse = land / .18;
        // footlights glow on every beat
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let x = -OX + 40; x < W + OX; x += 56) { ctx.fillStyle = `rgba(255,200,90,${.18 + pulse * .3 + (win ? .25 : 0) * (.5 + .5 * Math.sin(now * 12 + x))})`; ctx.beginPath(); ctx.arc(x, 492, 14 + pulse * 6, 0, 7); ctx.fill(); }
        ctx.restore();
        // curtain tassels sway
        for (const sd of [-1, 1]) { const cw = 46 + OX * .35, tx = sd < 0 ? -OX + cw - 8 : W + OX - cw + 8, sw = Math.sin(now * 1.6 + sd) * 3; tassel(tx, 338, sw); }
        // the balcony boxes: the loudest critics in town
        const BX = [{ x: 58, who: 'bug' }, { x: 632, who: 'claude' }];
        BX.forEach((B, i) => {
          const bx = B.x + (i ? OX * .0 : 0), by = 104, hop = win ? Math.abs(Math.sin(now * 9 + i)) * 12 : 0;
          ctx.save(); rr(bx, by, 110, 84, 10); ctx.clip();
          if (B.who === 'bug') {
            drawBug(bx + 40, by + 52 - hop, lose ? Math.sin(now * 10) * .15 : win ? Math.sin(now * 9) * .12 : Math.sin(now * 2) * .04, .62, now * (win ? 3 : .3));
            // popcorn bucket
            ctx.fillStyle = '#fff'; rr(bx + 64, by + 24 - hop * .5, 30, 28, 4); ink('#f3efe6', 3);
            ctx.fillStyle = '#e8433a'; for (let k = 0; k < 3; k++) ctx.fillRect(bx + 70 + k * 9, by + 24 - hop * .5, 4, 22);
            ctx.fillStyle = '#fff1a8'; for (const d of [[68, 42], [76, 38], [85, 42], [92, 40]]) { ctx.beginPath(); ctx.arc(bx + d[0], by + d[1] - hop * .5, 5, 0, 7); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke(); }
          } else {
            claude(bx + 55, by + 56 - hop, 4, { col: '#4DB8FF', mood: lose ? 'sad' : win ? 'happy' : null, run: null });
            // opera glasses
            ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx + 42, by + 24 - hop); ctx.lineTo(bx + 68, by + 24 - hop); ctx.stroke();
            ctx.strokeStyle = '#e8b84a'; ctx.lineWidth = 3; ctx.stroke(); ctx.lineCap = 'butt';
            circ(bx + 42, by + 24 - hop, 7, '#2a2438', 3); circ(bx + 68, by + 24 - hop, 7, '#2a2438', 3); circ(bx + 40, by + 22 - hop, 2, '#fff', 0); circ(bx + 66, by + 22 - hop, 2, '#fff', 0);
          }
          ctx.restore();
          // gilded ledge
          rr(bx - 6, by + 62, 122, 24, 9); ink('#b3862a', 4);
          ctx.save(); rr(bx - 6, by + 62, 122, 24, 9); ctx.clip(); ctx.translate(-2, -4); rr(bx - 6, by + 62, 122, 24, 9); ctx.fillStyle = '#f0c24f'; ctx.fill(); ctx.restore();
          ctx.fillStyle = 'rgba(255,255,255,.45)'; rr(bx + 4, by + 66, 70, 5, 2.5); ctx.fill();
        });
        // flying roses (win) or tomatoes (lose): thrown low and wide around the stamp
        if (win || lose) {
          for (let i = 0; i < 6; i++) {
            const sd = i % 2, k = clamp01((endT - Math.floor(i / 2) * .13) / .55); if (endT < Math.floor(i / 2) * .13) continue;
            const x0 = sd ? 690 : 112, y0 = 150, x1 = win ? (sd ? 470 + (i >> 1) * 12 : 330 - (i >> 1) * 12) : CX + (sd ? 26 : -26) + ((i >> 1) - 1) * 14, y1 = win ? 505 + (i >> 1) * 6 : CF - 55 + (i >> 1) * 8;
            const e = k, px = x0 + (x1 - x0) * e, py = y0 + (y1 - y0) * e * e - Math.sin(e * Math.PI) * 70;
            if (win) rose(px, py, k < 1 ? e * 12 : 0, 1 + (k >= 1 ? 0 : .1));
            else if (k < 1) tomato(px, py, e * 9);
            else splat(x1, y1, i);
          }
        }
        // the 4/4 pattern: marching dashes show the direction, the segment the ball is on glows
        ctx.lineCap = 'round'; ctx.setLineDash([14, 13]); ctx.lineDashOffset = -now * 40;
        MARKS.forEach((M, k) => {
          const A = MARKS[(k + 3) % 4], on = act && act.k === k;
          ctx.strokeStyle = on ? 'rgba(255,225,77,.95)' : 'rgba(255,240,200,.3)'; ctx.lineWidth = on ? 8 : 6;
          ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo(CTRL[k][0], CTRL[k][1], M.x, M.y); ctx.stroke();
        });
        ctx.setLineDash([]); ctx.lineCap = 'butt';
        MARKS.forEach((M, k) => {
          const on = P && P.k === k && lit(P), o = fl[k], sc = 1 + o.f * 1.2 + (on ? .08 + Math.sin(now * 30) * .03 : 0);
          ctx.save(); ctx.translate(M.x, M.y); ctx.scale(sc, sc);
          const face = o.bad > 0 ? '#FF4D4D' : o.f > 0 ? '#fff' : on ? '#FFE14D' : '#f7ecd0', shade = o.bad > 0 ? '#c0283a' : o.f > 0 ? '#e8e0f0' : on ? '#e0a928' : '#cfb98a';
          const disc = () => { ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); };
          ctx.beginPath(); ctx.arc(0, 8, R, 0, 7); ink('#8a5a1e', 4);   // the brass base gives the plate depth
          disc(); ink(shade, 4); ctx.save(); disc(); ctx.clip(); ctx.translate(-4, -5); disc(); ctx.fillStyle = face; ctx.fill(); ctx.restore();
          ctx.save(); disc(); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-R * .38, -R * .5, R * .3, R * .14, -.5, 0, 7); ctx.fill(); ctx.restore();
          ctx.strokeStyle = 'rgba(138,90,30,.45)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, R - 7, 0, 7); ctx.stroke();
          drawArrow(0, 0, M.dir, 19, on ? '#FF4D9E' : o.bad > 0 || o.f > 0 ? 'rgba(20,16,28,.7)' : '#5a3a6a');
          circ(R * .74, -R * .74, 13, on ? '#FF4D9E' : '#3a2a55', 3); txt(String(k + 1), R * .74, -R * .74 + 1, 17, '#fff');
          ctx.restore();
        });
        // count-in: the number pops on its own mark
        if (count && !g.result && clock < beats[4].t - WIN) { const M = MARKS[count - 1]; txt(String(count), M.x, M.y + 2, 58 * (1 + Math.max(0, .25 - countT) * 1.6), count === 4 ? '#FFE14D' : '#fff'); }
        // the beat ball: travels the pattern and lands on each mark exactly on its beat
        if (!g.result) {
          const u = clamp01(1 - (nx.t - clock) / beat), p = bez(nx.k, u * u), sq = land / .18;
          for (let i = 1; i <= 3; i++) { const q = bez(nx.k, Math.max(0, u - i * .07) ** 2); ctx.globalAlpha = .35 - i * .09; circ(q.x, q.y, 11 - i * 2, '#FF4D9E', 0); }
          ctx.globalAlpha = 1; ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1 + sq * .35, 1 - sq * .3);
          circ(0, 0, 13, '#FF4D9E', 4); circ(-4, -4, 4, '#fff', 0); ctx.restore();
        }
        // musicians
        MUS.forEach((m, mi) => {
          if (m.side && OX < 90) return;
          const x = mx(m), y = 530, b = win ? .45 + .5 * Math.abs(Math.sin(now * 8 + mi)) : m.bob, hop = Math.sin(b * Math.PI) * 9, mood = lose || m.sad > 0 ? 'sad' : win ? 'happy' : null;
          shadow(x, y + 2, 34, 8, .3);
          ctx.save(); ctx.translate(x, y - hop); ctx.scale(1 + b * .12, 1 - b * .12);
          instrument(m, b, mood);
          ctx.restore();
          if (m.sad > 0 || lose) txt('#@!', x, y - 78 - hop, 18, '#FF4D4D');
        });
        for (const n of notes) { ctx.globalAlpha = Math.min(1, n.life * 2); noteGlyph(n.x, n.y, n.c); ctx.globalAlpha = 1; }
        // the maestro on his podium (podium is baked)
        const k = kick / .3, bow = win ? Math.sin(Math.min(endT * 5, Math.PI)) * .35 : 0;
        ctx.save(); ctx.translate(CX, CF); ctx.scale(1 + k * .1, 1 - k * .1 - bow * .25); ctx.translate(-CX, -CF);
        ctx.fillStyle = '#1c1828'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(CX + sd * 6 * U, CF - 4 * U); ctx.lineTo(CX + sd * 1.5 * U, CF - 4 * U); ctx.lineTo(CX + sd * 8.5 * U, CF + .5 * U); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        [[-5, -9, 2.2], [-2, -10.1, 2.5], [1.6, -10.3, 2.5], [5, -9.2, 2.2]].forEach(([dx, dy, r]) => circ(CX + dx * U, CF + dy * U + (win ? 0 : Math.sin(now * 9 + dx) * 1.5), r * U, '#f3efe6', 4));
        claude(CX, CF, U, { mood: lose || sad > 0 ? 'sad' : win ? 'happy' : null, run: null });
        ctx.lineWidth = 3; ctx.strokeStyle = INK;
        for (const sd of [-1, 1]) { ctx.fillStyle = '#221d30'; ctx.beginPath(); ctx.moveTo(CX + sd * 6 * U, CF - 4.6 * U); ctx.lineTo(CX + sd * 1.2 * U, CF - 2 * U); ctx.lineTo(CX + sd * 6 * U, CF - 2 * U); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(CX - 2.4 * U, CF - 4.6 * U); ctx.lineTo(CX + 2.4 * U, CF - 4.6 * U); ctx.lineTo(CX, CF - 2 * U); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#FF4D4D';
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(CX, CF - 4.4 * U); ctx.lineTo(CX + sd * 1.8 * U, CF - 5.3 * U); ctx.lineTo(CX + sd * 1.8 * U, CF - 3.5 * U); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        circ(CX, CF - 4.4 * U, .55 * U, '#FF4D4D', 2);
        ctx.restore();
        // stretchy arm + baton, tip glued to the pointer
        const S = { x: CX + side * 7 * U, y: CF - 5.3 * U }, dx = tip.x - S.x, dy = tip.y - S.y, L = Math.hypot(dx, dy) || 1, bl = Math.min(50, L * .5);
        const Hx = tip.x - dx / L * bl, Hy = tip.y - dy / L * bl, ex = (S.x + Hx) / 2 + side * 26, ey = (S.y + Hy) / 2 + 22;
        ctx.lineCap = 'round';
        ctx.strokeStyle = INK; ctx.lineWidth = 17; ctx.beginPath(); ctx.moveTo(S.x, S.y); ctx.quadraticCurveTo(ex, ey, Hx, Hy); ctx.stroke();
        ctx.strokeStyle = '#2a2438'; ctx.lineWidth = 10; ctx.stroke();
        for (let i = trail.length - 1; i > 0; i--) { ctx.globalAlpha = (1 - i / trail.length) * .6; ctx.strokeStyle = '#FFE14D'; ctx.lineWidth = 10 * (1 - i / trail.length); ctx.beginPath(); ctx.moveTo(trail[i].x, trail[i].y); ctx.lineTo(trail[i - 1].x, trail[i - 1].y); ctx.stroke(); }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(Hx, Hy); ctx.lineTo(tip.x, tip.y); ctx.stroke();
        ctx.strokeStyle = '#fff8e0'; ctx.lineWidth = 4; ctx.stroke(); ctx.lineCap = 'butt';
        circ(Hx, Hy, 9, '#fff', 3);
        star(tip.x, tip.y, 11, 4.5, 4, now * 6, '#FFE14D', 2);
        if (lose && endT > .5) for (const d of [[-14, -4], [12, -14]]) splat(CX + d[0], CF - 40 + d[1], d[0]);   // tomatoes landed on the maestro
        // HUD: a gilded programme plaque with the tally, tomatoes mark the sour notes
        ctx.fillStyle = 'rgba(20,16,28,.3)'; rr(CX - 140 + 4, 70 + 7, 280, 74, 16); ctx.fill();
        rr(CX - 140, 70, 280, 74, 16); ink('#b3862a', 4);
        ctx.save(); rr(CX - 140, 70, 280, 74, 16); ctx.clip(); ctx.translate(-3, -4); rr(CX - 140, 70, 280, 74, 16); ctx.fillStyle = '#f0c24f'; ctx.fill(); ctx.restore();
        rr(CX - 128, 78, 256, 58, 10); ink('#3a1642', 3);
        ctx.fillStyle = 'rgba(255,255,255,.2)'; rr(CX - 122, 81, 150, 6, 3); ctx.fill();
        txt(window.t('NOTES {n} / {need}', { n: hits, need: NEED }), W / 2, 100, 28, '#FFE14D');
        for (let i = 0; i <= MAXMISS; i++) {
          const x = W / 2 - MAXMISS * 13 + i * 26, used = i < misses;
          if (used) { circ(x, 126, 9, '#e8433a', 3); ctx.fillStyle = '#4fd06a'; ctx.beginPath(); ctx.moveTo(x, 118); ctx.lineTo(x - 6, 115); ctx.lineTo(x - 2, 119); ctx.lineTo(x + 2, 115); ctx.closePath(); ctx.fill(); circ(x - 3, 123, 2, '#fff', 0); }
          else circ(x, 126, 8, 'rgba(255,255,255,.3)', 3);
        }
        if (win) { const s = 1 + Math.max(0, .3 - endT) * 1.2; ctx.save(); ctx.translate(CX, 232 + Math.sin(now * 14) * 4); ctx.scale(s, s); badge('BRAVO!', 0, 0, 56, '#e8a21c', -.06); ctx.restore(); }
        if (lose) { ctx.save(); ctx.translate(CX, 232 + Math.sin(now * 20) * 4); badge('BOO!', 0, 0, 60, '#d6303d', .05); ctx.restore(); }
        vignette(.3);
      },
      probe() {
        const b = pend(), M = b && MARKS[b.k], nb = beats.find(b => clock < b.t);
        return { phase: g.result ? 'done' : clock < beats[4].t - PEARLY ? 'count' : 'play', clock: +clock.toFixed(3), beat, win: WIN, early: PEARLY,
          hits, misses, need: NEED, hist, zone: ZONE, wrongZone: WZ, tip: { x: ptr.x, y: ptr.y }, lit: !!(b && lit(b)),
          ball: nb ? { mark: nb.k, dt: +(nb.t - clock).toFixed(3) } : null,
          next: b ? { j: b.j, mark: b.k, prev: (b.k + 3) % 4, code: M.codes[0], x: M.x, y: M.y, dt: +(b.t - clock).toFixed(3) } : null };
      }
    };
    return g;
  };

  /* ---- DUO art kit (local): X is the context everything below paints on, swapped to an offscreen canvas while baking ---- */
  let X = null, BG = null, BGox = -1;
  const clamp01 = k => Math.max(0, Math.min(1, k));
  function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
  function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } X.lineCap = 'butt'; }
  function celR(x, y, w, h, r, base, shade, sx, sy, o = 4) { rr(x, y, w, h, r); ink(shade, o); X.save(); rr(x, y, w, h, r); X.clip(); X.translate(-sx, -sy); rr(x, y, w, h, r); X.fillStyle = base; X.fill(); X.restore(); }
  function badge(s, x, y, size, bgc, rot) {
    X.font = `900 ${size}px "Arial Black", Impact, sans-serif`; const w = Math.min(320, X.measureText(t(s)).width + size * .9), h = size * 1.45;
    X.save(); X.translate(x, y); X.rotate(rot);
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(-w / 2 + 4, -h / 2 + 7, w, h, h * .46); X.fill();
    rr(-w / 2, -h / 2, w, h, h * .46); ink(bgc, 4); X.fillStyle = 'rgba(255,255,255,.35)'; rr(-w / 2 + 8, -h / 2 + 5, w - 16, h * .26, h * .13); X.fill();
    txt(s, 0, 2, size, '#fff', 'center', w - 18); X.restore();
  }
  function tassel(x, y, sw) {
    X.save(); X.translate(x, y); X.rotate(sw * .02);
    X.strokeStyle = INK; X.lineWidth = 8; X.lineCap = 'round'; X.beginPath(); X.moveTo(0, 0); X.lineTo(0, 14); X.stroke(); X.strokeStyle = '#f0c24f'; X.lineWidth = 3; X.stroke(); X.lineCap = 'butt';
    X.beginPath(); X.moveTo(-6, 14); X.lineTo(6, 14); X.lineTo(9, 36); X.lineTo(-9, 36); X.closePath(); ink('#f0c24f', 2.5);
    X.restore();
  }
  function rose(x, y, rot, s) {
    X.save(); X.translate(x, y); X.rotate(rot * .3); X.scale(s, s);
    X.strokeStyle = INK; X.lineWidth = 9; X.lineCap = 'round'; X.beginPath(); X.moveTo(0, 0); X.lineTo(-14, 16); X.stroke(); X.strokeStyle = '#3fa64a'; X.lineWidth = 4; X.stroke(); X.lineCap = 'butt';
    X.beginPath(); X.arc(0, 0, 10, 0, 7); ink('#e8304a', 3.5); X.strokeStyle = '#a81a34'; X.lineWidth = 2.5; X.beginPath(); X.arc(1, 1, 5, .3, 5); X.stroke();
    X.fillStyle = 'rgba(255,255,255,.55)'; X.beginPath(); X.ellipse(-4, -5, 3.5, 2, -.5, 0, 7); X.fill();
    X.restore();
  }
  function tomato(x, y, rot) {
    X.save(); X.translate(x, y); X.rotate(rot * .5);
    X.beginPath(); X.arc(0, 0, 12, 0, 7); ink('#d6303d', 3.5); X.fillStyle = '#4fd06a'; X.beginPath(); X.moveTo(0, -11); X.lineTo(-7, -14); X.lineTo(-3, -8); X.lineTo(0, -15); X.lineTo(3, -8); X.lineTo(7, -14); X.closePath(); X.fill();
    X.fillStyle = 'rgba(255,255,255,.55)'; X.beginPath(); X.ellipse(-4, -3, 3.5, 2, -.5, 0, 7); X.fill();
    X.restore();
  }
  function splat(x, y, sd) {   // decor only: deterministic from the seed, never touches the game RNG
    const h = k => { const v = Math.sin((sd + 3.1) * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
    X.save(); X.translate(x, y); X.fillStyle = '#d6303d'; X.strokeStyle = INK; X.lineWidth = 3; X.lineJoin = 'round';
    X.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283, r = i % 2 ? 7 + h(i) * 5 : 13 + h(i) * 6; X.lineTo(Math.cos(a) * r, Math.sin(a) * r * .8); } X.closePath(); X.stroke(); X.fill();
    X.fillStyle = '#ff7a86'; X.beginPath(); X.ellipse(-3, -3, 4, 2.5, -.5, 0, 7); X.fill();
    X.fillStyle = '#d6303d'; X.fillRect(-2, 8, 4, 8 + h(20) * 6); X.restore();
  }
  /* the opera house, baked once: gold wallpaper, proscenium, velvet curtains, boards, footlights, spotlight, podium */
  function buildBg() {
    const c = document.createElement('canvas'); c.width = Math.ceil(VW); c.height = H; X = c.getContext('2d'); X.translate(OX, 0);
    const L = -OX, R2 = W + OX, FY = 486;
    let gr = X.createLinearGradient(0, 0, 0, FY); gr.addColorStop(0, '#3a1448'); gr.addColorStop(.6, '#6a2250'); gr.addColorStop(1, '#8c3558'); X.fillStyle = gr; X.fillRect(L, 0, VW, FY);
    X.fillStyle = 'rgba(255,205,110,.14)'; for (let x = L + 10; x < R2; x += 44) X.fillRect(x, 0, 6, FY);   // damask stripes
    X.fillStyle = 'rgba(255,205,110,.2)'; for (let x = L + 32; x < R2; x += 44) for (let y = 70; y < FY; y += 50) { X.beginPath(); X.moveTo(x, y - 7); X.lineTo(x + 6, y); X.lineTo(x, y + 7); X.lineTo(x - 6, y); X.closePath(); X.fill(); }
    // spotlight cone + warm halo on the podium
    gr = X.createLinearGradient(0, 0, 0, FY); gr.addColorStop(0, 'rgba(255,236,170,.0)'); gr.addColorStop(.35, 'rgba(255,236,170,.13)'); gr.addColorStop(1, 'rgba(255,236,170,.2)');
    X.fillStyle = gr; X.beginPath(); X.moveTo(CX - 18, 0); X.lineTo(CX + 18, 0); X.lineTo(CX + 230, FY); X.lineTo(CX - 230, FY); X.closePath(); X.fill();
    gr = X.createRadialGradient(CX, 330, 20, CX, 330, 300); gr.addColorStop(0, 'rgba(255,236,170,.22)'); gr.addColorStop(1, 'rgba(255,236,170,0)'); X.fillStyle = gr; X.fillRect(CX - 300, 30, 600, 600);
    // proscenium valance
    X.beginPath(); X.moveTo(L, -6); X.lineTo(R2, -6); X.lineTo(R2, 22); for (let x = R2; x > L; x -= 50) X.quadraticCurveTo(x - 25, 40, x - 50, 22); X.closePath(); ink('#a3192f', 3.5);
    X.fillStyle = 'rgba(20,16,28,.25)'; for (let x = L; x < R2; x += 50) { X.beginPath(); X.moveTo(x + 25, 0); X.quadraticCurveTo(x + 40, 20, x + 50, 24); X.lineTo(x + 50, 0); X.closePath(); X.fill(); }
    X.fillStyle = '#f0c24f'; for (let x = L + 25; x < R2; x += 50) { X.beginPath(); X.arc(x, 31, 4, 0, 7); X.fill(); }
    // back-wall balcony niches (the boxes are drawn live)
    for (const bx of [58, 632]) { rr(bx - 10, 86, 130, 110, 14); ink('#d9a63a', 4); rr(bx - 2, 94, 114, 94, 10); ink('#3a1020', 3); X.fillStyle = 'rgba(255,255,255,.12)'; rr(bx + 6, 98, 50, 6, 3); X.fill(); }
    // stage boards
    X.fillStyle = INK; X.fillRect(L, FY - 3, VW, 7);
    gr = X.createLinearGradient(0, FY, 0, H); gr.addColorStop(0, '#b97a46'); gr.addColorStop(1, '#8a5530'); X.fillStyle = gr; X.fillRect(L, FY + 3, VW, H - FY);
    X.fillStyle = 'rgba(20,16,28,.22)'; for (let x = L + 30; x < R2; x += 64) X.fillRect(x, FY + 4, 4, H - FY);
    X.fillStyle = 'rgba(255,255,255,.1)'; for (let x = L; x < R2; x += 96) { X.beginPath(); X.moveTo(x + 20, FY + 4); X.lineTo(x + 50, FY + 4); X.lineTo(x + 20, H); X.lineTo(x - 10, H); X.closePath(); X.fill(); }
    X.fillStyle = 'rgba(20,16,28,.3)'; X.beginPath(); X.ellipse(CX, 520, 140, 22, 0, 0, 7); X.fill();
    // footlight housings
    for (let x = L + 40; x < R2; x += 56) { celR(x - 12, 484, 24, 14, 5, '#f0c24f', '#b3862a', 2, 3, 2.5); X.fillStyle = '#fff3a0'; X.beginPath(); X.arc(x, 489, 3.5, 0, 7); X.fill(); }
    // velvet side curtains with cel folds and a gold tie-back
    const cw = 46 + OX * .35;
    for (const sd of [-1, 1]) {
      const x0 = sd < 0 ? L : R2 - cw;
      X.fillStyle = INK; X.fillRect(sd < 0 ? x0 + cw - 2 : x0 - 6, 0, 8, H);
      X.fillStyle = '#a3192f'; X.fillRect(x0, -4, cw, H + 4);
      X.fillStyle = '#7d1224'; for (let i = 0; i < 4; i++) X.fillRect(x0 + cw * (i + .55) / 4, 0, cw / 9, H);
      X.fillStyle = 'rgba(255,255,255,.14)'; for (let i = 0; i < 4; i++) X.fillRect(x0 + cw * (i + .2) / 4, 0, cw / 18, H);
      X.beginPath(); X.ellipse(sd < 0 ? x0 + cw - 8 : x0 + 8, 330, cw * .5, 10, 0, 0, 7); ink('#f0c24f', 3);
    }
    // podium
    celR(CX - 64, CF, 128, 24, 6, '#a5622c', '#7a431c', 5, -5, 4); X.fillStyle = 'rgba(255,255,255,.28)'; rr(CX - 52, CF + 4, 54, 5, 2.5); X.fill();
    X.fillStyle = '#f0c24f'; X.beginPath(); X.arc(CX, CF + 16, 3, 0, 7); X.fill();
    const out = c; X = ctx; return out;
  }

  /* a musician at (0,0) = feet: Claudes in other colours, bugs on drum and cymbals */
  function instrument(m, b, mood) {
    const sw = Math.sin(now * 9) * 7 * (b > 0 ? 1.6 : .5);
    ctx.lineCap = 'round'; ctx.strokeStyle = INK;
    if (m.k === 'drum' || m.k === 'cymbal') {
      drawBug(0, -34, 0, .72, now * (b > 0 ? 2 : .4));
      if (m.k === 'drum') {
        ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-14, -40); ctx.lineTo(-20, -30 + b * -14); ctx.moveTo(14, -40); ctx.lineTo(22, -30 + b * -14); ctx.stroke();
        ctx.fillStyle = '#e8433a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.rect(-27, -24, 54, 24); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#FFE14D'; for (let i = -1; i <= 1; i++) ctx.fillRect(i * 16 - 2, -22, 4, 20);
        ctx.fillStyle = '#f3efe6'; ctx.beginPath(); ctx.ellipse(0, -24, 27, 8, 0, 0, 7); ctx.fill(); ctx.stroke();
      } else for (const sd of [-1, 1]) { ctx.save(); ctx.translate(sd * (26 - b * 12), -38); ctx.rotate(sd * (1.2 - b * .4)); ctx.fillStyle = '#FFC93C'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 0, 16, 5, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); }
      ctx.lineCap = 'butt'; return;
    }
    if (m.k === 'cello') { ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(10, -6); ctx.lineTo(16, -66); ctx.stroke(); }
    if (m.k === 'tuba') { ctx.save(); ctx.translate(-22, -48); ctx.rotate(-.5); ctx.fillStyle = '#FFC93C'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-6, 14); ctx.lineTo(-14, -12); ctx.lineTo(14, -12); ctx.lineTo(6, 14); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
    claude(0, 0, 4, { col: m.col, mood, run: null });
    ctx.lineCap = 'round'; ctx.strokeStyle = INK;
    if (m.k === 'violin') {
      ctx.save(); ctx.translate(-20, -22); ctx.rotate(-.45);
      ctx.fillStyle = '#b0602a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 0, 15, 9, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.fillRect(-34, -2.5, 20, 5); ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-40 + sw, -40); ctx.lineTo(4 + sw, -6); ctx.stroke();
      ctx.strokeStyle = '#f3efe6'; ctx.lineWidth = 2; ctx.stroke();
    } else if (m.k === 'trumpet') {
      ctx.fillStyle = '#FFC93C'; ctx.lineWidth = 4; ctx.beginPath(); ctx.rect(2, -20, 26, 7); ctx.fill(); ctx.stroke();
      const fl = 10 + b * 6; ctx.beginPath(); ctx.moveTo(26, -17); ctx.lineTo(42, -17 - fl); ctx.lineTo(42, -17 + fl); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (m.k === 'tuba') {
      ctx.strokeStyle = INK; ctx.lineWidth = 13; ctx.beginPath(); ctx.arc(-4, -18, 15, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#FFC93C'; ctx.lineWidth = 7; ctx.stroke();
    } else if (m.k === 'cello') {
      ctx.fillStyle = '#9a4d22'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(12, -20, 13, 20, .1, 0, 7); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-12 + sw, -18); ctx.lineTo(34 + sw, -24); ctx.stroke(); ctx.strokeStyle = '#f3efe6'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }
  function noteGlyph(x, y, c) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-.25);
    ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(7, -26); ctx.lineTo(17, -18); ctx.stroke();
    ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = c; ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.beginPath(); ctx.ellipse(0, 0, 9, 6.5, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
})();
