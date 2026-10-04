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
        const win = g.result === 'win', lose = g.result === 'lose', P = pend(), nx = beats.find(b => clock < b.t) || beats[19], act = g.result ? null : P && P.t <= nx.t ? P : nx;
        bg('#2a1238', '#35184a', t);
        const gl = ctx.createRadialGradient(CX, 330, 20, CX, 330, 300); gl.addColorStop(0, 'rgba(255,236,170,.22)'); gl.addColorStop(1, 'rgba(255,236,170,0)');
        ctx.fillStyle = gl; ctx.fillRect(CX - 300, 30, 600, 600);
        // stage floor + curtains
        ctx.fillStyle = INK; ctx.fillRect(-OX, 486, VW, 120); ctx.fillStyle = '#7a4524'; ctx.fillRect(-OX, 492, VW, 110);
        ctx.fillStyle = 'rgba(20,16,28,.25)'; for (let x = -OX + 30; x < W + OX; x += 64) ctx.fillRect(x, 492, 4, 110);
        shadow(CX, 520, 140, 22, .25);
        const cw = 46 + OX * .35;
        for (const sd of [-1, 1]) {
          const x0 = sd < 0 ? -OX : W + OX - cw;
          ctx.fillStyle = INK; ctx.fillRect(sd < 0 ? x0 + cw : x0 - 6, 0, 6, H);
          ctx.fillStyle = '#a3192f'; ctx.fillRect(x0, 0, cw, H);
          ctx.fillStyle = 'rgba(20,16,28,.28)'; for (let i = 0; i < 4; i++) ctx.fillRect(x0 + cw * (i + .55) / 4, 0, cw / 9, H);
        }
        // the 4/4 pattern: marching dashes show the direction, the segment the ball is on glows
        ctx.lineCap = 'round'; ctx.setLineDash([14, 13]); ctx.lineDashOffset = -now * 40;
        MARKS.forEach((M, k) => {
          const A = MARKS[(k + 3) % 4], on = act && act.k === k;
          ctx.strokeStyle = on ? 'rgba(255,225,77,.9)' : 'rgba(255,255,255,.22)'; ctx.lineWidth = on ? 8 : 6;
          ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo(CTRL[k][0], CTRL[k][1], M.x, M.y); ctx.stroke();
        });
        ctx.setLineDash([]); ctx.lineCap = 'butt';
        MARKS.forEach((M, k) => {
          const on = P && P.k === k && lit(P), o = fl[k], sc = 1 + o.f * 1.2 + (on ? .08 + Math.sin(now * 30) * .03 : 0);
          ctx.save(); ctx.translate(M.x, M.y); ctx.scale(sc, sc);
          ctx.fillStyle = o.bad > 0 ? '#FF4D4D' : o.f > 0 ? '#fff' : on ? '#FFE14D' : 'rgba(255,255,255,.13)';
          ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill(); ctx.stroke();
          drawArrow(0, 0, M.dir, 19, on ? '#FF4D9E' : 'rgba(255,255,255,.55)');
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
        MUS.forEach(m => {
          if (m.side && OX < 90) return;
          const x = mx(m), y = 540, b = m.bob, hop = Math.sin(b * Math.PI) * 9, mood = lose || m.sad > 0 ? 'sad' : win ? 'happy' : null;
          shadow(x, y + 2, 34, 8, .3);
          ctx.save(); ctx.translate(x, y - hop); ctx.scale(1 + b * .12, 1 - b * .12);
          instrument(m, b, mood);
          ctx.restore();
          if (m.sad > 0 || lose) txt('#@!', x, y - 78 - hop, 18, '#FF4D4D');
        });
        for (const n of notes) { ctx.globalAlpha = Math.min(1, n.life * 2); noteGlyph(n.x, n.y, n.c); ctx.globalAlpha = 1; }
        // the maestro on his podium
        box3(CX - 60, CF, 120, 20, '#8a4b2a', 4, 4);
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
        // HUD + count-in + results
        txt(window.t('NOTES {n} / {need}', { n: hits, need: NEED }), W / 2, 100, 30, '#FFE14D');
        for (let i = 0; i <= MAXMISS; i++) {
          const x = W / 2 - MAXMISS * 13 + i * 26, used = i < misses; circ(x, 134, 8, used ? '#FF4D4D' : 'rgba(255,255,255,.35)', 3);
          if (used) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 4, 130); ctx.lineTo(x + 4, 138); ctx.moveTo(x + 4, 130); ctx.lineTo(x - 4, 138); ctx.stroke(); }
        }
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
