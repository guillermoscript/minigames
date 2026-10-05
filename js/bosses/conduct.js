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
        if (!BK || BKW !== VW) { BK = bake(); BKW = VW; }
        // the opera house (baked once) + its live gags: dust in the spotlight, a sleeping cardboard moon, the boxes' audience
        ctx.drawImage(BK.back, -OX, 0);
        dust();
        moon(win, lose);
        crowd({ win, lose, sad: sad > 0, kick: kick / .3, endT, hits });
        ctx.drawImage(BK.front, -OX, 0);
        if (win) { ctx.save(); ctx.translate(CX, 272); ctx.globalAlpha = .28; ctx.fillStyle = '#FFE14D'; for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(300, -26); ctx.lineTo(300, 26); ctx.closePath(); ctx.fill(); } ctx.restore(); }
        // the 4/4 pattern: marching dashes show the direction, the segment the ball is on glows
        ctx.lineCap = 'round';
        MARKS.forEach((M, k) => {
          const A = MARKS[(k + 3) % 4], on = act && act.k === k;
          ctx.setLineDash([]); ctx.strokeStyle = on ? 'rgba(120,70,0,.5)' : 'rgba(60,30,100,.28)'; ctx.lineWidth = on ? 13 : 10;
          ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo(CTRL[k][0], CTRL[k][1], M.x, M.y); ctx.stroke();
          ctx.setLineDash([14, 13]); ctx.lineDashOffset = -now * 40;
          ctx.strokeStyle = on ? '#FFE14D' : 'rgba(255,255,255,.75)'; ctx.lineWidth = on ? 8 : 5.5; ctx.stroke();
        });
        ctx.setLineDash([]); ctx.lineCap = 'butt';
        MARKS.forEach((M, k) => {
          const on = P && P.k === k && lit(P), o = fl[k], sc = 1 + o.f * 1.2 + (on ? .08 + Math.sin(now * 30) * .03 : 0);
          const bad = o.bad > 0, hot = o.f > 0, dp = hot ? 3 : 8;
          const face = bad ? '#ff4d5e' : hot ? '#ffffff' : on ? '#FFE14D' : '#f3e7cf', shd = bad ? '#c8283a' : hot ? '#d9d2e8' : on ? '#e8b800' : '#d6c3a0', bas = bad ? '#8f1c32' : hot ? '#a79fba' : on ? '#b8860b' : '#9a8460';
          ctx.save(); ctx.translate(M.x, M.y); ctx.scale(sc, sc);
          // a drum-pad plate with depth: dark base, cel-shaded face, gloss
          X.fillStyle = 'rgba(20,16,28,.28)'; el(5, R + 9, R * .9, 9); X.fill();
          X.beginPath(); X.arc(0, dp, R, 0, TAU); ink(bas, 5);
          cel(() => { X.beginPath(); X.arc(0, 0, R, 0, TAU); }, face, shd, 6, 7, 5);
          X.fillStyle = 'rgba(255,255,255,.55)'; el(-R * .38, -R * .5, R * .26, R * .14, -.6); X.fill();
          if (on) { X.strokeStyle = `rgba(255,255,255,${.5 + Math.sin(now * 18) * .3})`; X.lineWidth = 4; X.beginPath(); X.arc(0, 0, R + 11, 0, TAU); X.stroke(); }
          drawArrow(0, 0, M.dir, 19, on ? '#FF4D9E' : '#b7a3d6');
          X.beginPath(); X.arc(R * .74, -R * .74, 13, 0, TAU); ink(on ? '#FF4D9E' : '#e8b23a', 3);
          txt(String(k + 1), R * .74, -R * .74 + 1, 16, on ? '#fff' : INK);
          ctx.restore();
        });
        // count-in: the number pops on its own mark
        if (count && !g.result && clock < beats[4].t - WIN) { const M = MARKS[count - 1]; txt(String(count), M.x, M.y + 2, 58 * (1 + Math.max(0, .25 - countT) * 1.6), count === 4 ? '#FFE14D' : '#fff'); }
        // the beat ball: travels the pattern and lands on each mark exactly on its beat
        if (!g.result) {
          const u = c01(1 - (nx.t - clock) / beat), p = bez(nx.k, u * u), sq = land / .18;
          for (let i = 1; i <= 3; i++) { const q = bez(nx.k, Math.max(0, u - i * .07) ** 2); ctx.globalAlpha = .35 - i * .09; circ(q.x, q.y, 11 - i * 2, '#FF4D9E', 0); }
          ctx.globalAlpha = 1; ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1 + sq * .35, 1 - sq * .3);
          X.beginPath(); X.arc(0, 0, 14, 0, TAU); ink('#FF4D9E', 4);
          X.fillStyle = '#c92a78'; X.beginPath(); X.arc(0, 0, 14, .2, 1.9); X.arc(-3, -2, 11, 1.7, .3, true); X.fill();
          X.fillStyle = 'rgba(255,255,255,.7)'; el(-5, -6, 4.5, 2.6, -.6); X.fill();
          const lx = MARKS[nx.k].x > p.x ? 1 : -1; eye(-4.5, 1, 3.4, null, lx, 0, 1); eye(4.5, 1, 3.4, null, lx, 0, 2);
          ctx.restore();
        }
        // musicians
        MUS.forEach(m => {
          if (m.side && OX < 90) return;
          const x = mx(m), y = 536, b = m.bob, hop = Math.sin(b * Math.PI) * 9 + (win ? Math.abs(Math.sin(now * 9 + x)) * 12 : 0), mood = lose || m.sad > 0 ? 'sad' : win ? 'happy' : null;
          shadow(x, y + 2, 34, 8, .3);
          ctx.save(); ctx.translate(x, y - hop); ctx.scale(1 + b * .12, 1 - b * .12);
          instrument(m, b, mood);
          ctx.restore();
          if (m.sad > 0 || lose) { bubble(x + 6, y - 84 - hop, '#@!'); sweat(x - 26, y - 38 - hop, now + x); }
          if (win) heart(x + 20, y - 88 - hop - ((endT * 60 + x) % 40), .8);
        });
        for (const n of notes) { ctx.globalAlpha = Math.min(1, n.life * 2); noteGlyph(n.x, n.y, n.c); ctx.globalAlpha = 1; }
        // the maestro on his podium
        const k = kick / .3, bow = win ? Math.sin(Math.min(endT * 5, Math.PI)) * .35 : 0, droop = lose ? 7 : 0;
        ctx.save(); ctx.translate(CX, CF); ctx.scale(1 + k * .1, 1 - k * .1 - bow * .25); ctx.translate(-CX, -CF);
        // tailcoat tails
        for (const sd of [-1, 1]) {
          cel(() => { X.beginPath(); X.moveTo(CX + sd * 6 * U, CF - 4 * U); X.lineTo(CX + sd * 1.5 * U, CF - 4 * U); X.lineTo(CX + sd * 8.5 * U, CF + .5 * U); X.closePath(); }, '#2a2438', '#14101c', sd * 3, 2, 3);
        }
        // powdered wig: cel-shaded curls that bounce with the beat and wilt on a loss
        const curls = [[-5, -9, 2.2], [-2, -10.1, 2.5], [1.6, -10.3, 2.5], [5, -9.2, 2.2], [-6.4, -7.4, 1.6], [6.4, -7.4, 1.6]];
        curls.forEach(([dx, dy, r], i) => {
          const cx = CX + dx * U, cy = CF + dy * U + (win ? 0 : Math.sin(now * 9 + dx) * 1.5) + (i > 3 ? droop * 1.4 : droop * .5) - k * 3;
          cel(() => { X.beginPath(); X.arc(cx, cy, r * U, 0, TAU); }, '#f6f2ea', '#cdc6dc', 3, 4, 3.5);
        });
        X.fillStyle = 'rgba(255,255,255,.8)'; el(CX - 3.6 * U, CF - 10.9 * U - droop * .5, 1.2 * U, .6 * U, -.5); X.fill();
        claude(CX, CF, U, { mood: lose || sad > 0 ? 'sad' : win ? 'happy' : null, run: null });
        // cel shade + light on the body
        X.fillStyle = 'rgba(20,16,28,.17)'; X.fillRect(CX + 4.2 * U, CF - 9 * U, 1.8 * U, 7 * U); X.fillRect(CX - 6 * U, CF - 3.4 * U, 12 * U, 1.4 * U);
        X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(CX - 5.2 * U, CF - 8.3 * U, 1.4 * U, 3.2 * U);
        // lapels, shirt, bow tie
        for (const sd of [-1, 1]) {
          cel(() => { X.beginPath(); X.moveTo(CX + sd * 6 * U, CF - 4.6 * U); X.lineTo(CX + sd * 1.2 * U, CF - 2 * U); X.lineTo(CX + sd * 6 * U, CF - 2 * U); X.closePath(); }, '#2a2438', '#14101c', sd * 3, 2, 3);
        }
        cel(() => { X.beginPath(); X.moveTo(CX - 2.4 * U, CF - 4.6 * U); X.lineTo(CX + 2.4 * U, CF - 4.6 * U); X.lineTo(CX, CF - 2 * U); X.closePath(); }, '#fff', '#d9d5e6', 3, 2, 3);
        X.fillStyle = '#FF4D4D';
        for (const sd of [-1, 1]) { X.beginPath(); X.moveTo(CX, CF - 4.4 * U); X.lineTo(CX + sd * 1.8 * U, CF - 5.3 * U); X.lineTo(CX + sd * 1.8 * U, CF - 3.5 * U); X.closePath(); ink('#FF4D4D', 2.5); }
        X.beginPath(); X.arc(CX, CF - 4.4 * U, .55 * U, 0, TAU); ink('#ff6b6b', 2);
        if (lose || sad > 0) sweat(CX + 5.6 * U, CF - 8.4 * U, now * 1.3);
        ctx.restore();
        // stretchy arm + baton, tip glued to the pointer
        const S = { x: CX + side * 7 * U, y: CF - 5.3 * U }, dx = tip.x - S.x, dy = tip.y - S.y, L = Math.hypot(dx, dy) || 1, bl = Math.min(50, L * .5);
        const Hx = tip.x - dx / L * bl, Hy = tip.y - dy / L * bl, ex = (S.x + Hx) / 2 + side * 26, ey = (S.y + Hy) / 2 + 22;
        ctx.lineCap = 'round';
        ctx.strokeStyle = INK; ctx.lineWidth = 17; ctx.beginPath(); ctx.moveTo(S.x, S.y); ctx.quadraticCurveTo(ex, ey, Hx, Hy); ctx.stroke();
        ctx.strokeStyle = '#2a2438'; ctx.lineWidth = 10; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(S.x, S.y - 3); ctx.quadraticCurveTo(ex, ey - 3, Hx, Hy - 3); ctx.stroke();
        for (let i = trail.length - 1; i > 0; i--) { ctx.globalAlpha = (1 - i / trail.length) * .6; ctx.strokeStyle = '#FFE14D'; ctx.lineWidth = 10 * (1 - i / trail.length); ctx.beginPath(); ctx.moveTo(trail[i].x, trail[i].y); ctx.lineTo(trail[i - 1].x, trail[i - 1].y); ctx.stroke(); }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(Hx, Hy); ctx.lineTo(tip.x, tip.y); ctx.stroke();
        ctx.strokeStyle = '#fff8e0'; ctx.lineWidth = 4; ctx.stroke(); ctx.lineCap = 'butt';
        circ(Hx, Hy, 9, '#fff', 3);   // white glove
        X.fillStyle = 'rgba(20,16,28,.18)'; X.beginPath(); X.arc(Hx + 2, Hy + 3, 6, 0, TAU); X.fill();
        star(tip.x, tip.y, 11, 4.5, 4, now * 6, '#FFE14D', 2);
        // gifts from the boxes: roses on a win, tomatoes on a loss
        thrown(win, lose, endT);
        // HUD: the brass marquee over the stage arch, one lamp per allowed sour note
        hud(win, lose, hits, misses);
        if (win) txt('BRAVO!', CX, 272 + Math.sin(now * 14) * 4, 72 * (1 + Math.max(0, .3 - endT)), '#FFE14D');
        if (lose) txt('BOO!', CX, 272 + Math.sin(now * 20) * 4, 80, '#FF4D4D');
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

  /* ───────────── art only: the opera house kit (draws on X, which is swapped for the offscreen bake) ───────────── */
  const TAU = Math.PI * 2, c01 = k => Math.max(0, Math.min(1, k));
  const hs = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };   // decor randomness: never the game RNG
  let X = ctx, BK = null, BKW = 0;
  function rr(x, y, w, h, r) { X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r); X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath(); }
  function el(x, y, rx, ry, rot = 0) { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, TAU); }
  function ink(fill, o = 4) { X.lineJoin = 'round'; X.lineCap = 'round'; if (o) { X.lineWidth = o * 2; X.strokeStyle = INK; X.stroke(); } if (fill) { X.fillStyle = fill; X.fill(); } }
  /* cel shading: the shade shows as a crescent on the (sx, sy) side, because the base is drawn again shifted by (-sx, -sy) inside a clip */
  function cel(build, base, shade, sx, sy, o = 4) { build(); ink(shade, o); X.save(); build(); X.clip(); X.translate(-sx, -sy); X.fillStyle = base; build(); X.fill(); X.restore(); }
  function tube(pts, w, col) { X.lineCap = 'round'; X.lineJoin = 'round'; for (const [lw, c] of [[w + 6, INK], [w, col]]) { X.lineWidth = lw; X.strokeStyle = c; X.beginPath(); pts.forEach((p, i) => i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1])); X.stroke(); } }
  function eye(x, y, r, mood, lx = 0, ly = 0, k = 0) {
    X.lineCap = 'round';
    if (mood === 'happy') { X.strokeStyle = INK; X.lineWidth = r * .6; X.beginPath(); X.arc(x, y + r * .4, r * .8, Math.PI * 1.12, Math.PI * 1.88); X.stroke(); return; }
    if (Math.sin(now * 1.9 + k) > .985) { X.strokeStyle = INK; X.lineWidth = r * .5; X.beginPath(); X.moveTo(x - r, y); X.lineTo(x + r, y); X.stroke(); return; }
    const R2 = mood === 'wide' ? r * 1.25 : r;
    el(x, y, R2, R2 * 1.08); ink('#fff', r * .28);
    const pr = R2 * (mood === 'wide' ? .38 : .52), px = x + lx * R2 * .38, py = y + ly * R2 * .38;
    X.fillStyle = INK; el(px, py, pr, pr * 1.05); X.fill();
    X.fillStyle = '#fff'; el(px - pr * .35, py - pr * .4, pr * .35, pr * .35); X.fill();
  }
  function sweat(x, y, seed) { const k = (seed * .8) % 1; X.globalAlpha = 1 - k * k; X.save(); X.translate(x, y + k * 16); X.beginPath(); X.moveTo(0, -7); X.quadraticCurveTo(6, 0, 0, 5); X.quadraticCurveTo(-6, 0, 0, -7); ink('#9fe3ff', 2); X.restore(); X.globalAlpha = 1; }
  function heart(x, y, s) {
    X.save(); X.translate(x, y); X.scale(s, s); X.beginPath(); X.moveTo(0, 8); X.bezierCurveTo(-18, -4, -12, -20, 0, -10); X.bezierCurveTo(12, -20, 18, -4, 0, 8); X.closePath();
    ink('#ff5c8a', 3); X.fillStyle = 'rgba(255,255,255,.6)'; el(-6, -9, 3, 2, -.6); X.fill(); X.restore();
  }
  function bubble(x, y, s) {
    X.beginPath(); X.moveTo(x - 6, y + 10); X.lineTo(x - 10, y + 22); X.lineTo(x + 4, y + 10); X.closePath(); ink('#fff', 2.5);
    rr(x - 26, y - 14, 52, 28, 12); ink('#fff', 3); txt(s, x, y + 1, 16, '#FF4D4D');
  }
  const brass = (build, o = 3.5) => cel(build, '#FFC93C', '#d99a1c', 3, 3, o);

  /* ───────────── the baked opera house: [back] wall, painted backdrop, boxes, stage, podium · [front] box ledges + curtains ───────────── */
  function mk() { const c = document.createElement('canvas'); c.width = VW; c.height = H; return c; }
  function bake() {
    const old = X, back = mk(), front = mk(), L = -OX - 4, R = W + OX + 4, VWd = R - L, cw = 46 + OX * .35;
    const bx = [[L - 12, 142], [658, R + 12]];
    let g;
    X = back.getContext('2d'); X.translate(OX, 0);
    // velvet-and-gold wall
    g = X.createLinearGradient(0, 0, 0, 490); g.addColorStop(0, '#4a2358'); g.addColorStop(1, '#8a3f6c'); X.fillStyle = g; X.fillRect(L, 0, VWd, 492);
    X.fillStyle = 'rgba(255,205,130,.12)'; for (let x = L + 10; x < R; x += 58) X.fillRect(x, 0, 20, 490);
    X.fillStyle = 'rgba(255,205,130,.2)'; for (let y = 120; y < 480; y += 100) for (let x = L + 20; x < R; x += 58) { X.beginPath(); X.moveTo(x, y - 7); X.lineTo(x + 7, y); X.lineTo(x, y + 7); X.lineTo(x - 7, y); X.closePath(); X.fill(); }
    // the stage arch with a painted backdrop in it
    const arch = () => { X.beginPath(); X.moveTo(150, 492); X.lineTo(150, 330); X.arc(400, 330, 250, Math.PI, 0); X.lineTo(650, 492); X.closePath(); };
    arch(); g = X.createLinearGradient(0, 80, 0, 490); g.addColorStop(0, '#8a9af0'); g.addColorStop(.6, '#cdbcff'); g.addColorStop(1, '#f2e3ff'); X.fillStyle = g; X.fill();
    X.save(); arch(); X.clip();
    X.fillStyle = 'rgba(255,255,255,.55)';   // painted clouds
    for (const [cx, cy, s] of [[250, 215, 1], [520, 262, .8], [330, 140, .7]]) { for (const [dx, dy, r] of [[-22, 6, 15], [0, -4, 20], [24, 6, 16], [6, 10, 15]]) { X.beginPath(); X.arc(cx + dx * s, cy + dy * s, r * s, 0, TAU); X.fill(); } }
    X.fillStyle = '#ffe98a'; X.strokeStyle = '#e0b94a'; X.lineWidth = 3; X.beginPath(); X.arc(500, 425, 42, 0, TAU); X.fill(); X.stroke();   // a painted sun in shades...
    X.fillStyle = INK; rr(476, 410, 22, 12, 4); X.fill(); rr(504, 410, 22, 12, 4); X.fill(); X.fillRect(496, 414, 10, 3);
    X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round'; X.beginPath(); X.arc(500, 432, 12, .25, Math.PI - .25); X.stroke();
    X.fillStyle = '#b7a6f2'; X.beginPath(); X.ellipse(300, 500, 200, 80, 0, 0, TAU); X.fill();
    X.fillStyle = '#a592ec'; X.beginPath(); X.ellipse(560, 510, 170, 70, 0, 0, TAU); X.fill();
    X.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 9; i++) { X.beginPath(); X.arc(180 + hs(i) * 460, 110 + hs(i + 20) * 90, 1.6 + hs(i + 40) * 1.4, 0, TAU); X.fill(); }
    X.restore();
    arch(); X.lineJoin = 'round'; X.lineWidth = 26; X.strokeStyle = INK; X.stroke(); X.lineWidth = 16; X.strokeStyle = '#b9821c'; X.stroke(); X.lineWidth = 10; X.strokeStyle = '#e8b23a'; X.stroke(); X.lineWidth = 3; X.strokeStyle = '#ffe68a'; X.stroke();
    // stage floor
    g = X.createLinearGradient(0, 490, 0, 600); g.addColorStop(0, '#c58a52'); g.addColorStop(1, '#8a5530'); X.fillStyle = g; X.fillRect(L, 490, VWd, 112);
    X.fillStyle = 'rgba(255,255,255,.07)'; for (let x = L; x < R; x += 128) { X.beginPath(); X.moveTo(x, 492); X.lineTo(x + 40, 492); X.lineTo(x + 10, 600); X.lineTo(x - 30, 600); X.closePath(); X.fill(); }
    X.strokeStyle = 'rgba(60,30,20,.32)'; X.lineWidth = 3; for (let x = L + 20; x < R; x += 64) { X.beginPath(); X.moveTo(x, 494); X.lineTo(x - (x - 400) * .12, 600); X.stroke(); }
    X.fillStyle = INK; X.fillRect(L, 488, VWd, 5);
    // the spotlight cone + its pool on the boards
    g = X.createLinearGradient(0, 0, 0, 520); g.addColorStop(0, 'rgba(255,244,190,.02)'); g.addColorStop(1, 'rgba(255,244,190,.2)');
    X.fillStyle = g; X.beginPath(); X.moveTo(372, 0); X.lineTo(428, 0); X.lineTo(580, 520); X.lineTo(220, 520); X.closePath(); X.fill();
    X.fillStyle = 'rgba(255,240,180,.25)'; el(400, 522, 190, 26); X.fill();
    // the box seats: a dark opening under a velvet valance
    for (const [x0, x1] of bx) {
      rr(x0, 100, x1 - x0, 118, 10); ink('#2a1240', 5);
      X.fillStyle = 'rgba(255,205,130,.12)'; for (let x = x0 + 8; x < x1; x += 22) X.fillRect(x, 106, 8, 108);
      cel(() => rr(x0, 88, x1 - x0, 26, 9), '#c0283f', '#8f1c32', 3, 4, 4);
      X.fillStyle = '#e8b23a'; for (let x = x0 + 12; x < x1; x += 22) { X.beginPath(); X.arc(x, 113, 4, 0, TAU); X.fill(); }
    }
    // the maestro's podium
    X.fillStyle = 'rgba(20,16,28,.3)'; el(CX, CF + 44, 110, 14); X.fill();
    cel(() => rr(CX - 56, CF + 8, 112, 30, 6), '#9a5a2e', '#74421f', 4, 5, 4);
    cel(() => rr(CX - 66, CF - 2, 132, 18, 7), '#c07a40', '#98602f', 3, 5, 4);
    X.fillStyle = 'rgba(255,255,255,.35)'; rr(CX - 56, CF + 1, 50, 4, 2); X.fill();
    // FRONT: box ledges with velvet drapes, then the curtains
    X = front.getContext('2d'); X.translate(OX, 0);
    for (const [x0, x1] of bx) {
      const w = x1 - x0;
      cel(() => rr(x0, 226, w, 44, 9), '#c0283f', '#8f1c32', 4, 6, 4);
      X.fillStyle = 'rgba(255,150,160,.3)'; for (let x = x0 + 16; x < x1 - 8; x += 24) { rr(x, 232, 4, 30, 2); X.fill(); }
      X.fillStyle = '#e8b23a'; for (let x = x0 + 10; x < x1; x += 14) { X.beginPath(); X.arc(x, 272, 5, 0, TAU); ink('#e8b23a', 2); }
      cel(() => rr(x0, 208, w, 24, 9), '#f0bf4a', '#c58a1c', 3, 5, 4);
      X.fillStyle = 'rgba(255,255,255,.5)'; rr(x0 + 14, 212, w - 40, 4, 2); X.fill();
    }
    for (const sd of [-1, 1]) {
      const x0 = sd < 0 ? -OX - 4 : W + OX + 4 - cw - 4, ww = cw + 4, xin = sd < 0 ? x0 + ww : x0;
      X.fillStyle = '#c0283f'; X.fillRect(x0, 0, ww, H);
      for (let i = 0; i < 4; i++) { X.fillStyle = '#8f1c32'; rr(x0 + ww * (i + .3) / 4, 0, ww / 6, H, ww / 12); X.fill(); X.fillStyle = 'rgba(255,150,160,.3)'; rr(x0 + ww * (i + .05) / 4, 0, ww / 14, H, 3); X.fill(); }
      X.fillStyle = INK; X.fillRect(xin - 3, 0, 6, H);
      // gold tie-back rope with a tassel
      X.save(); X.beginPath(); X.moveTo(x0, 296); X.quadraticCurveTo(xin + sd * -ww * .5, 316, xin + sd * 6, 292); X.lineTo(xin + sd * 6, 306); X.quadraticCurveTo(xin + sd * -ww * .5, 330, x0, 310); X.closePath(); ink('#e8b23a', 3); X.restore();
      X.beginPath(); X.arc(xin + sd * 6, 322, 8, 0, TAU); ink('#f0bf4a', 3);
      X.strokeStyle = '#e8b23a'; X.lineWidth = 3; X.lineCap = 'round'; for (let i = -2; i <= 2; i++) { X.beginPath(); X.moveTo(xin + sd * 6 + i * 3, 330); X.lineTo(xin + sd * 6 + i * 4, 350); X.stroke(); }
    }
    X = old;
    return { back, front };
  }

  /* ───────────── live background gags ───────────── */
  function dust() {   // dust drifting in the spotlight
    for (let i = 0; i < 16; i++) {
      const y = (hs(i + 40) * 470 + now * (8 + hs(i + 80) * 10)) % 470 + 20, x = 400 + (hs(i) - .5) * (60 + y * .45) + Math.sin(now * .6 + i * 2) * 14;
      ctx.fillStyle = `rgba(255,255,230,${.3 + .25 * Math.sin(now * 1.7 + i)})`; ctx.beginPath(); ctx.arc(x, y, 1.4 + hs(i + 9) * 1.6, 0, TAU); ctx.fill();
    }
  }
  function moon(win, lose) {   // a cardboard moon on strings, fast asleep until the verdict
    const a = Math.sin(now * 1.3) * .14;
    X.save(); X.translate(585, 162); X.rotate(a);
    X.strokeStyle = INK; X.lineWidth = 3; X.beginPath(); X.moveTo(-12, 0); X.lineTo(-10, 46); X.moveTo(12, 0); X.lineTo(10, 46); X.stroke();
    X.translate(0, 62);
    cel(() => { X.beginPath(); X.arc(0, 0, 30, 0, TAU); X.arc(15, -6, 25, 0, TAU, true); }, '#fff3a0', '#e8c85a', -4, 5, 3.5);
    X.fillStyle = 'rgba(255,255,255,.7)'; el(-18, -12, 5, 3, -.7); X.fill();
    X.strokeStyle = INK; X.lineWidth = 3; X.lineCap = 'round';
    if (lose) { X.beginPath(); X.moveTo(-23, -5); X.lineTo(-15, 3); X.moveTo(-15, -5); X.lineTo(-23, 3); X.stroke(); }
    else if (win) { X.beginPath(); X.arc(-19, 0, 5, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); }
    else { X.beginPath(); X.arc(-19, -1, 5, .15, Math.PI - .15); X.stroke(); }
    X.fillStyle = 'rgba(255,110,165,.55)'; el(-24, 7, 4.5, 3); X.fill();
    X.restore();
    X.beginPath(); X.arc(585, 162, 4, 0, TAU); ink('#e8b23a', 2);
    if (!win && !lose) for (let i = 0; i < 2; i++) {   // Z z
      const k = ((now * .5 + i * .5) % 1), zx = 556 - k * 10, zy = 196 - k * 34, s = 7 + i * 3;
      X.globalAlpha = 1 - k; X.strokeStyle = '#fff'; X.lineWidth = 3; X.lineJoin = 'round'; X.beginPath(); X.moveTo(zx - s, zy - s); X.lineTo(zx + s, zy - s); X.lineTo(zx - s, zy + s); X.lineTo(zx + s, zy + s); X.stroke(); X.globalAlpha = 1;
    }
  }
  const SPEC = [[76, 0], [118, 1], [W - 118, 2], [W - 76, 3]];
  function crowd(st) {
    SPEC.forEach(([x, kind], i) => {
      const j = Math.abs(Math.sin(now * 9 + i * 1.7));
      const rise = st.win ? 14 * j + 6 : st.lose ? -2 : st.kick > 0 ? 5 * st.kick : 0;
      const mood = st.win ? 'happy' : st.lose ? 'boo' : st.sad ? 'wince' : st.kick > 0 ? 'eager' : null;
      spec(kind, x, 194 - rise + Math.sin(now * 1.6 + i) * 1.5, mood, i, st);
    });
  }
  function spec(kind, x, y, mood, i, st) {
    const C = [['#7fd34a', '#4f9a2a'], ['#ff7ac8', '#c94d96'], ['#ffc93c', '#d99a1c'], ['#4db8ff', '#2a7fc4']][kind], lx = x < 400 ? 1 : -1, cheer = mood === 'happy' || mood === 'boo';
    if (cheer) { const sw = Math.sin(now * 12 + i * 2) * 5; for (const sd of [-1, 1]) { tube([[x + sd * 18, y + 26], [x + sd * 28, y + 4 + sw * sd], [x + sd * 31, y - 14 + sw]], 8, C[0]); X.beginPath(); X.arc(x + sd * 31, y - 15 + sw, 6, 0, TAU); ink(mood === 'boo' ? '#fff' : C[0], 2.5); } }
    cel(() => el(x, y + 26, 25, 17), C[0], C[1], 4, 5, 4);
    if (kind === 2) for (const sd of [-1, 1]) { X.beginPath(); X.moveTo(x + sd * 8, y - 12); X.lineTo(x + sd * 20, y - 30); X.lineTo(x + sd * 21, y - 6); X.closePath(); ink(C[0], 3.5); X.beginPath(); X.moveTo(x + sd * 12, y - 14); X.lineTo(x + sd * 18, y - 24); X.lineTo(x + sd * 18, y - 11); X.closePath(); X.fillStyle = '#ff9db8'; X.fill(); }
    cel(() => el(x, y, 21, 19), C[0], C[1], 5, 5, 4);
    X.fillStyle = 'rgba(255,255,255,.4)'; el(x - 9, y - 10, 6, 3, -.5); X.fill();
    const em = mood === 'happy' ? 'happy' : mood === 'eager' ? 'wide' : mood === 'wince' ? 'wide' : null;
    eye(x - 8, y - 2, 5.5, em, lx, mood === 'boo' ? .6 : 0, i); eye(x + 8, y - 2, 5.5, em, lx, mood === 'boo' ? .6 : 0, i + 3);
    X.strokeStyle = INK; X.lineWidth = 3.5; X.lineCap = 'round';
    if (mood === 'boo') { for (const sd of [-1, 1]) { X.beginPath(); X.moveTo(x + sd * 14, y - 13); X.lineTo(x + sd * 3, y - 8); X.stroke(); } el(x, y + 11, 6, 4.5); ink('#6e1838', 2); }
    else if (mood === 'happy') { X.beginPath(); X.moveTo(x - 7, y + 7); X.quadraticCurveTo(x, y + 18, x + 7, y + 7); X.closePath(); ink('#6e1838', 2); }
    else if (mood === 'wince') { X.beginPath(); X.moveTo(x - 6, y + 11); X.quadraticCurveTo(x, y + 6, x + 6, y + 11); X.stroke(); }
    else { X.beginPath(); X.moveTo(x - 4, y + 10); X.lineTo(x + 4, y + 10 + (kind === 2 ? Math.sin(now * 14) * 1.5 : 0)); X.stroke(); }
    X.fillStyle = 'rgba(255,110,165,.5)'; el(x - 15, y + 5, 4.5, 3); X.fill(); el(x + 15, y + 5, 4.5, 3); X.fill();
    if (kind === 0) {   // a hat with a feather big enough to block the view
      const sw = Math.sin(now * 2.2 + i) * 5 + (mood === 'happy' ? Math.sin(now * 12) * 6 : 0);
      tube([[x + 8, y - 30], [x + 18 + sw * .5, y - 44], [x + 14 + sw, y - 60]], 5, '#ff4d5e');
      cel(() => rr(x - 14, y - 36, 28, 22, 8), '#9a4bc2', '#6b2c8c', 3, 4, 3.5);
      cel(() => el(x, y - 15, 28, 6.5), '#9a4bc2', '#6b2c8c', 3, 3, 3.5);
      X.fillStyle = '#ffd23f'; rr(x - 14, y - 22, 28, 5, 2); X.fill();
    } else if (kind === 1) {   // opera glasses
      const dn = mood === 'happy' ? 12 : 0;
      for (const sd of [-1, 1]) { X.beginPath(); X.arc(x + sd * 8, y - 2 + dn, 8, 0, TAU); X.lineWidth = 7; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3; X.strokeStyle = '#e8b23a'; X.stroke(); }
      tube([[x - 2, y - 2 + dn], [x + 2, y - 2 + dn]], 3, '#e8b23a'); tube([[x, y + 4 + dn], [x + 8, y + 22 + dn]], 3, '#e8b23a');
    } else if (kind === 2) {   // cat: whiskers, nose and the popcorn
      X.beginPath(); X.moveTo(x - 3, y + 3); X.lineTo(x + 3, y + 3); X.lineTo(x, y + 7); X.closePath(); ink('#ff7a9a', 1.5);
      X.strokeStyle = INK; X.lineWidth = 2; for (const sd of [-1, 1]) for (const dy of [-2, 4]) { X.beginPath(); X.moveTo(x + sd * 16, y + 6 + dy * .3); X.lineTo(x + sd * 30, y + 6 + dy); X.stroke(); }
      const bx0 = x - 36, by = 192;
      for (let q = 0; q < 4; q++) { const hop = Math.abs(Math.sin(now * 5 + q * 1.7)) * (st.kick > 0 || mood === 'happy' ? 12 : 3); X.beginPath(); X.arc(bx0 - 6 + q * 6, by - 3 - hop, 4.2, 0, TAU); ink('#fff6d0', 1.5); }
      cel(() => { X.beginPath(); X.moveTo(bx0 - 14, by); X.lineTo(bx0 + 14, by); X.lineTo(bx0 + 10, by + 26); X.lineTo(bx0 - 10, by + 26); X.closePath(); }, '#fff', '#d9d5e6', 3, 2, 3);
      X.fillStyle = '#ff4d5e'; for (let q = -1; q <= 1; q += 2) { X.beginPath(); X.moveTo(bx0 + q * 7 - 3.5, by); X.lineTo(bx0 + q * 7 + 3.5, by); X.lineTo(bx0 + q * 5 + 3, by + 26); X.lineTo(bx0 + q * 5 - 3, by + 26); X.closePath(); X.fill(); }
    } else {   // moustache + monocle + bow tie
      X.beginPath(); X.moveTo(x, y + 5); X.quadraticCurveTo(x - 8, y + 2, x - 15, y + 10); X.quadraticCurveTo(x - 6, y + 12, x, y + 8); X.quadraticCurveTo(x + 6, y + 12, x + 15, y + 10); X.quadraticCurveTo(x + 8, y + 2, x, y + 5); X.closePath(); ink('#5a3418', 2);
      X.beginPath(); X.arc(x + 8, y - 2, 8.5, 0, TAU); X.lineWidth = 7; X.strokeStyle = INK; X.stroke(); X.lineWidth = 3; X.strokeStyle = '#e8b23a'; X.stroke();
      for (const sd of [-1, 1]) { X.beginPath(); X.moveTo(x, y + 32); X.lineTo(x + sd * 9, y + 27); X.lineTo(x + sd * 9, y + 37); X.closePath(); ink('#ff4d5e', 2.5); }
    }
  }
  /* roses (win) or tomatoes (lose) fly from the boxes and land on the boards: positions are a pure function of the outro clock */
  function thrown(win, lose, e) {
    if (!win && !lose) return;
    const L = win ? [[96, 176, 262, 516], [118, 176, 330, 506], [W - 118, 176, 470, 510], [W - 76, 176, 540, 520]] : [[96, 176, 222, 498], [118, 176, CX - 34, CF - 64], [W - 118, 176, 578, 498], [W - 76, 176, 708, 498]];
    L.forEach(([x0, y0, x1, y1], i) => {
      const d = i * .09; if (e < d) return;
      const u = c01((e - d) / .5), x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * (win ? 150 : 70);
      if (win) {
        X.save(); X.translate(x, y); X.rotate(u < 1 ? e * 9 + i : -.6 + i * .5);
        tube([[0, 0], [-16, 6]], 3, '#2f9a55'); X.beginPath(); X.arc(0, 0, 8, 0, TAU); ink('#ff4d5e', 3); X.strokeStyle = '#b8283a'; X.lineWidth = 2.5; X.beginPath(); X.arc(0, 0, 3.5, .5, 5); X.stroke();
        X.restore();
      } else if (u < 1) { X.save(); X.translate(x, y); X.rotate(e * 8 + i); X.beginPath(); X.arc(0, 0, 9, 0, TAU); ink('#ff4d5e', 3); X.fillStyle = '#2f9a55'; X.fillRect(-4, -11, 8, 4); X.restore(); }
      else { // splat with drips
        X.save(); X.translate(x1, y1); el(0, 0, 18, 11, -.2); ink('#e8434f', 2.5);
        for (const [dx, dl] of [[-8, 10], [3, 15], [11, 7]]) { rr(dx - 2.5, 4, 5, dl, 2.5); ink('#e8434f', 1.5); }
        X.fillStyle = 'rgba(255,255,255,.5)'; el(-6, -3, 5, 2.5, -.4); X.fill(); X.restore();
      }
    });
  }
  /* the brass marquee over the stage arch: NOTES counter + one lamp per allowed sour note */
  function hud(win, lose, hits, misses) {
    X.fillStyle = 'rgba(20,16,28,.3)'; rr(254, 70, 300, 76, 16); X.fill();
    rr(250, 68, 300, 76, 16); ink('#8a5c10', 4);
    cel(() => rr(250, 62, 300, 76, 16), '#f0bf4a', '#c58a1c', 3, 6, 4);
    X.fillStyle = 'rgba(255,255,255,.5)'; rr(262, 66, 150, 4, 2); X.fill();
    rr(264, 72, 272, 60, 10); ink('#3a1d4a', 2.5);
    txt(window.t('NOTES {n} / {need}', { n: hits, need: NEED }), W / 2, 92, 28, '#FFE14D');
    for (let i = 0; i <= MAXMISS; i++) {
      const x = W / 2 - MAXMISS * 13 + i * 26, used = i < misses || lose, y = 120;
      if (!used) { X.fillStyle = win ? `hsl(${(i * 72 + now * 300) % 360},95%,60%)` : 'rgba(255,230,120,.22)'; X.beginPath(); X.arc(x, y, 13, 0, TAU); X.fill(); }
      X.beginPath(); X.arc(x, y, 8, 0, TAU); ink(used ? '#7a1c28' : win ? `hsl(${(i * 72 + now * 300) % 360},95%,62%)` : '#fff0a8', 2.5);
      if (used) { X.strokeStyle = '#ff6b6b'; X.lineWidth = 2.5; X.beginPath(); X.moveTo(x - 4, y - 4); X.lineTo(x + 4, y + 4); X.moveTo(x + 4, y - 4); X.lineTo(x - 4, y + 4); X.stroke(); }
      else { X.fillStyle = 'rgba(255,255,255,.8)'; el(x - 2.5, y - 3, 2.5, 1.6, -.6); X.fill(); }
    }
  }

  /* a musician at (0,0) = feet: Claudes in other colours, bugs on drum and cymbals */
  function claudeShaded(col, mood) {
    claude(0, 0, 4, { col, mood, run: null });
    X.fillStyle = 'rgba(20,16,28,.16)'; X.fillRect(17, -36, 7, 28); X.fillRect(-24, -13.6, 48, 5.6);
    X.fillStyle = 'rgba(255,255,255,.3)'; X.fillRect(-20.8, -33.2, 5.6, 12);
  }
  function instrument(m, b, mood) {
    const sw = Math.sin(now * 9) * 7 * (b > 0 ? 1.6 : .5);
    X.lineCap = 'round'; X.strokeStyle = INK;
    if (m.k === 'drum' || m.k === 'cymbal') {
      drawBug(0, -34, 0, .72, now * (b > 0 ? 2 : .4));
      if (m.k === 'drum') {
        cel(() => { X.beginPath(); X.moveTo(-7, -63); X.lineTo(7, -63); X.lineTo(1, -85); X.closePath(); }, '#ff5c8a', '#c93a64', 2, 2, 3);
        X.beginPath(); X.arc(1, -86, 3.5, 0, TAU); ink('#fff', 2);
        tube([[-14, -40], [-20, -30 - b * 14]], 3, '#fff3d0'); tube([[14, -40], [22, -30 - b * 14]], 3, '#fff3d0');
        cel(() => rr(-27, -26, 54, 26, 5), '#e8433a', '#b8283a', 4, 4, 4);
        X.strokeStyle = '#FFE14D'; X.lineWidth = 3.5; for (let i = -1; i <= 1; i++) { X.beginPath(); X.moveTo(i * 16 - 8, -22); X.lineTo(i * 16, -4); X.lineTo(i * 16 + 8, -22); X.stroke(); }
        cel(() => el(0, -26, 27, 8), '#f3efe6', '#cfc7d8', 3, 3, 4);
      } else {
        cel(() => el(0, -66, 9, 8), '#2a2438', '#14101c', 2, 2, 3); cel(() => el(0, -61, 15, 4), '#2a2438', '#14101c', 2, 2, 3);
        for (const sd of [-1, 1]) { X.save(); X.translate(sd * (26 - b * 12), -38); X.rotate(sd * (1.2 - b * .4)); brass(() => el(0, 0, 16, 5), 4); X.fillStyle = 'rgba(255,255,255,.6)'; el(-5, -1.5, 6, 1.4); X.fill(); X.restore(); }
      }
      X.lineCap = 'butt'; return;
    }
    if (m.k === 'cello') { tube([[10, -6], [16, -66]], 4, '#5a3418'); X.beginPath(); X.arc(16, -68, 4.5, 0, TAU); ink('#5a3418', 2.5); }
    if (m.k === 'tuba') { X.save(); X.translate(-22, -48); X.rotate(-.5); brass(() => { X.beginPath(); X.moveTo(-6, 14); X.lineTo(-14, -12); X.lineTo(14, -12); X.lineTo(6, 14); X.closePath(); }, 4); X.fillStyle = 'rgba(255,255,255,.5)'; el(-8, -2, 2.4, 9, .3); X.fill(); X.restore(); }
    claudeShaded(m.col, mood);
    if (m.k === 'violin') {
      cel(() => rr(-23, -33, 16, 6, 3), '#c0283f', '#8f1c32', 2, 2, 3); X.beginPath(); X.arc(-15, -41, 3, 0, TAU); ink('#c0283f', 2);   // beret
    } else if (m.k === 'trumpet') {
      cel(() => rr(-9, -58, 18, 22, 3), '#2a2438', '#14101c', 3, 2, 3.5); cel(() => el(0, -36, 17, 4.5), '#2a2438', '#14101c', 2, 2, 3.5); X.fillStyle = '#ff4d5e'; X.fillRect(-9, -44, 18, 4);
    } else if (m.k === 'tuba') {
      for (let q = 0; q < 5; q++) { const a = q * TAU / 5; X.beginPath(); X.arc(-16 + Math.cos(a) * 5.5, -40 + Math.sin(a) * 5.5, 3.6, 0, TAU); ink('#fff', 1.8); }
      X.beginPath(); X.arc(-16, -40, 3, 0, TAU); ink('#FFE14D', 1.8);
    } else if (m.k === 'cello') {
      for (const sd of [-1, 1]) { X.beginPath(); X.arc(sd * 11.2, -24.8, 7, 0, TAU); X.lineWidth = 3; X.strokeStyle = INK; X.stroke(); }
      X.beginPath(); X.moveTo(-4.2, -24.8); X.lineTo(4.2, -24.8); X.stroke();
    }
    X.lineCap = 'round'; X.strokeStyle = INK;
    if (m.k === 'violin') {
      X.save(); X.translate(-20, -22); X.rotate(-.45);
      cel(() => el(0, 0, 15, 9), '#c07030', '#8f4f20', 3, 3, 4);
      X.fillStyle = INK; X.fillRect(-34, -2.5, 20, 5); X.fillStyle = '#5a3418'; X.fillRect(-12, -1, 14, 2); X.fillStyle = 'rgba(255,255,255,.4)'; el(-4, -4, 5, 2); X.fill(); X.restore();
      tube([[-40 + sw, -40], [4 + sw, -6]], 2, '#f3efe6');
    } else if (m.k === 'trumpet') {
      brass(() => rr(2, -22, 26, 8, 3), 3.5);
      const fl = 10 + b * 6; brass(() => { X.beginPath(); X.moveTo(26, -18); X.lineTo(42, -18 - fl); X.lineTo(42, -18 + fl); X.closePath(); }, 3.5);
      for (const vx of [8, 14, 20]) { rr(vx - 2, -29, 4, 8, 2); ink('#fff', 1.8); }
      X.fillStyle = 'rgba(255,255,255,.55)'; rr(5, -20, 18, 2, 1); X.fill();
    } else if (m.k === 'tuba') {
      X.beginPath(); X.arc(-4, -18, 15, 0, TAU); X.lineWidth = 15; X.strokeStyle = INK; X.stroke(); X.lineWidth = 9; X.strokeStyle = '#FFC93C'; X.stroke();
      X.lineWidth = 3; X.strokeStyle = '#d99a1c'; X.beginPath(); X.arc(-4, -18, 15, .3, 1.6); X.stroke();
      X.lineWidth = 2.5; X.strokeStyle = 'rgba(255,255,255,.7)'; X.beginPath(); X.arc(-4, -18, 15, 3.5, 4.6); X.stroke();
    } else if (m.k === 'cello') {
      cel(() => el(12, -20, 13, 20, .1), '#b0602a', '#7e4118', 4, 4, 4);
      X.strokeStyle = INK; X.lineWidth = 2; X.beginPath(); X.moveTo(12, -34); X.lineTo(12, -8); X.stroke();
      tube([[-12 + sw, -18], [34 + sw, -24]], 2.5, '#f3efe6');
    }
    X.lineCap = 'butt';
  }
  function noteGlyph(x, y, c) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-.25);
    ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(7, -26); ctx.lineTo(17, -18); ctx.stroke();
    ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = c; ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.beginPath(); ctx.ellipse(0, 0, 9, 6.5, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
})();
